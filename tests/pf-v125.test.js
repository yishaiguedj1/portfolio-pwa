// pf-v125.test.js — גרף הביצועים: טווחים לפי תאריך, TWR יומי מ־NAV יומי,
// תזרימים ב־ChangeInNAV (רווח/הפסד בלי הפקדות), תוויות ציר בלי כפילויות.
// תקלה מהשטח (24/09/2026): כל טווח (חודש/3 חודשים/שנה) הציג אותה תשואה
// (+47.83%, כל התקופה), ו"רווח/הפסד" ≈ כל שווי התיק. IBKR: 1Y +9.18%, YTD +19.26%.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const R = require(path.join(root, 'returns.js'));

let n = 0;
function ok(cond, name) {
  n++;
  if (!cond) { console.error('FAIL - ' + name); process.exit(1); }
  console.log('ok - ' + name);
}
const near = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-9);

function makeSandbox() {
  const store = {};
  const sb = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    document: {
      addEventListener() {},
      getElementById: () => null,
      querySelectorAll: () => [], querySelector: () => null,
      createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }),
    },
    window: {}, navigator: {}, location: {},
    AbortController, fetch: (...a) => fetch(...a),
    setTimeout, clearTimeout, console,
  };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(root, 'returns.js'), 'utf8'), sb);
  vm.runInContext(src, sb);
  return sb;
}

(async () => {
  const sb = makeSandbox();
  const A = (name) => vm.runInContext(name, sb);

  // --- 1. טווחים לפי תאריך, לא לפי מספר שורות ---
  const cutoff = A('pfRangeCutoff');
  ok(cutoff('2026-09-23', '1m') === '2026-08-23', 'חודש: אותו יום בחודש הקודם');
  ok(cutoff('2026-09-23', 'ytd') === '2025-12-31', 'YTD: בסיס = 31/12 של השנה הקודמת');
  ok(cutoff('2026-09-23', 'year') === '2025-09-23', 'שנה: אותו יום לפני שנה');
  ok(cutoff('2026-03-31', '1m') === '2026-02-28', 'חודש: 31/3 -> 28/2 (סוף החודש)');
  ok(cutoff('2026-09-23', 'max') === null, 'מקסימום: בלי חיתוך');

  // נתוני תקופות (שורה לשנה) — מה שהיה אצל המשתמש
  const periods = [
    { fromDate: '2023-01-01', toDate: '2023-12-31', twr: 10 },
    { fromDate: '2024-01-01', toDate: '2024-12-30', twr: 5 },
    { fromDate: '2024-12-31', toDate: '2024-12-31', twr: 0 },
    { fromDate: '2025-01-01', toDate: '2025-12-31', twr: 8 },
    { fromDate: '2026-01-01', toDate: '2026-09-23', twr: 19.26 },
  ];
  const pRows = R.rTwrIndexSeries(periods);
  const slice = A('pfSliceRange');
  const ytd = slice(pRows, 'ytd');
  ok(ytd.gapDays === 0 && ytd.rows.length === 2, 'YTD בנתוני תקופות: בסיס מדויק ב־31/12/2025');
  ok(near(ytd.rows[1].value / ytd.rows[0].value * 100 - 100, 19.26, 1e-9), 'YTD = ה־TWR הרשמי של 2026 בדיוק');
  const oneY = slice(pRows, 'year');
  ok(oneY.gapDays > 10, 'שנה בנתוני תקופות: אין נקודה קרובה לבסיס -> מסומן כבלתי ניתן לחישוב (לא מציגים תשואה מומצאת)');
  const oneM = slice(pRows, '1m');
  ok(oneM.gapDays > 10, 'חודש בנתוני תקופות: בלתי ניתן לחישוב');
  ok(slice(pRows, 'max').rows.length === pRows.length, 'מקסימום: כל השורות');
  // לפני התיקון: filterRange('1m') = 22 השורות האחרונות = הכל
  ok(A('filterRange')(pRows, '1m').length === pRows.length, 'הבאג הישן מתועד: ספירת שורות לוקחת הכל בנתוני תקופות');

  // נתונים יומיים — פער של סופ"ש בלבד
  const daily = [];
  for (let d = new Date(Date.UTC(2025, 0, 1)); d <= new Date(Date.UTC(2026, 8, 23)); d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    daily.push({ date: d.toISOString().slice(0, 10), value: 100 });
  }
  const dM = slice(daily, '1m');
  ok(dM.gapDays <= 3 && dM.rows[0].date <= '2026-08-23', 'חודש בנתונים יומיים: בסיס בתוך סופ"ש מהתאריך');

  // --- 2. TWR יומי מ־NAV יומי: הפקדה לא נספרת כתשואה ---
  const nav = [
    { date: '2026-01-02', total: 1000 },
    { date: '2026-01-05', total: 1100 },   // +10%
    { date: '2026-01-06', total: 1600 },   // הפקדה 500, אין תשואה
    { date: '2026-01-07', total: 1440 },   // −10%
  ];
  const s1 = R.rDailyTwrSeries(nav, { '2026-01-06': 500 }, []);
  ok(s1.length === 4 && s1[0].value === 100, 'יומי: סדרה שמתחילה ב־100');
  ok(near(s1[2].value, 110, 1e-9), 'יומי: יום ההפקדה — אין קפיצה בתשואה');
  ok(near(s1[3].value, 99, 1e-9), 'יומי: +10% ואז −10% = −1%');
  const sNoFlow = R.rDailyTwrSeries(nav, {}, []);
  ok(sNoFlow[2].value > 150, 'בלי תזרימים ההפקדה הייתה נספרת כתשואה (ולכן חובה לנטרל)');

  // --- 3. עיגון לתקופה רשמית: מכפלת הימים = TWR רשמי בדיוק ---
  const nav2 = [{ date: '2025-12-31', total: 1000 }];
  let v = 1000;
  for (let i = 1; i <= 20; i++) { v *= 1.003; nav2.push({ date: '2026-01-' + String(i + 1).padStart(2, '0'), total: v }); }
  const per2 = [{ fromDate: '2026-01-01', toDate: '2026-01-21', twr: 5 }];
  const s2 = R.rDailyTwrSeries(nav2, {}, per2);
  ok(near(s2[s2.length - 1].value, 105, 1e-9), 'עיגון: סוף התקופה = TWR הרשמי (5%) בדיוק');
  ok(s2.every((r, i) => !i || r.value > s2[i - 1].value), 'עיגון: הצורה היומית נשמרת (עולה כל יום)');
  // כיסוי חלקי — לא מעגנים (עיוות)
  const per3 = [{ fromDate: '2025-06-01', toDate: '2026-01-21', twr: 50 }];
  const s3 = R.rDailyTwrSeries(nav2, {}, per3);
  ok(near(s3[s3.length - 1].value, 100 * Math.pow(1.003, 20), 1e-6), 'כיסוי חלקי של התקופה: בלי עיגון');

  // --- 4. סדרה משולבת: תקופות לפני ה־NAV היומי, יומי אחריו ---
  const comb = R.rCombinedTwrSeries([
    { fromDate: '2025-01-01', toDate: '2025-12-31', twr: 10 },
    { fromDate: '2026-01-01', toDate: '2026-01-21', twr: 5 },
  ], nav2, {});
  ok(comb[0].date === '2025-01-01' && near(comb[0].value, 100), 'משולב: מתחיל בתחילת התקופה הראשונה');
  ok(near(comb[comb.length - 1].value, 110 * 1.05, 1e-6), 'משולב: סוף = שרשור רשמי (10% ואז 5%)');
  ok(comb.filter((r) => r.date >= '2026-01-01').length === 20, 'משולב: יומי מתחילת 2026');
  ok(R.rCombinedTwrSeries(periods, [], {}).length === pRows.length, 'בלי NAV יומי: נקודות התקופות כמו קודם');

  // --- 5. איחוד NAV יומי ---
  const m = R.rMergeNavDaily([{ date: '2026-01-02', total: 1 }, { date: '2026-01-03', total: 2 }], [{ date: '2026-01-03', total: 3 }]);
  ok(m.length === 2 && m[1].total === 3, 'איחוד NAV יומי: החדש גובר ביום חופף');
  const md = R.rMergeData({ navDaily: [{ date: '2026-01-02', total: 1 }] }, { navDaily: [{ date: '2026-01-05', total: 2 }] });
  ok(md.navDaily.length === 2, 'rMergeData שומר NAV יומי משני הצדדים');

  // --- 6. רווח/הפסד: תזרימים מהדוח (לפני: netFlows=0 -> הפקדות נספרו כרווח) ---
  const gain = R.rGain({ navPeriods: [{ fromDate: '2026-01-01', toDate: '2026-06-30', startingValue: 0, endingValue: 1100, netFlows: 1000, twr: 10 }] });
  ok(gain === 100, 'רווח = סוף − התחלה − הפקדות');

  // --- 7. משיכה מ־IBKR: flows ו־navDaily עוברים דרך המיזוג הרב־חלקי ---
  const yest = A('ibkrLastClosedDate')(); // v136: אתמול לפי ניו־יורק
  const ymd = A('ibkrYmd');
  const startYmd = String(yest.getFullYear()) + '0101';
  const fetchFn = async (url, opts) => {
    const body = JSON.parse(opts.body || '{}');
    if (String(url).includes('/api/flex-request')) return { json: async () => ({ ok: true, referenceCode: 'R', statementUrl: '' }) };
    return { json: async () => ({ ok: true, status: 'ready', data: {
      meta: { fromDate: startYmd.slice(0, 4) + '-01-01', toDate: '2026-09-23', baseCurrency: 'USD' },
      trades: [], positions: [], cashTransactions: [],
      navHistory: [{ fromDate: startYmd.slice(0, 4) + '-01-01', toDate: ymd(yest).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'), startingValue: 0, endingValue: 1100, twr: 10, flows: 1000 }],
      navDaily: [{ date: startYmd.slice(0, 4) + '-01-02', total: 1000 }, { date: startYmd.slice(0, 4) + '-01-05', total: 1010 }],
    } }) };
  };
  const full = await A('ibkrFetchFullHistory')(fetchFn, 'https://proxy', 'tok', 'q', startYmd, null, { chunkGapMs: 0 });
  ok(full.navPeriods[0].netFlows === 1000, 'משיכה: netFlows מהדוח (לא 0)');
  ok(full.navDaily.length === 2, 'משיכה: NAV יומי נשמר בתוצאה');

  // --- 8. תזרימים לפי תאריך, במטבע הבסיס ---
  const flows = A('ibkrFlowsByDate')({
    meta: { baseCurrency: 'USD' },
    cashTransactions: [
      { date: '2026-01-06', amount: 500, currency: 'USD', type: 'Deposits/Withdrawals', description: 'Wire' },
      { date: '2026-01-06', amount: 1000, currency: 'ILS', fxToBase: 0.3, type: 'Deposits/Withdrawals', description: 'Wire' },
      { date: '2026-01-07', amount: -200, currency: 'USD', type: 'Transfer OUT', description: '' },
      { date: '2026-01-08', amount: 7, currency: 'USD', type: 'Dividends', description: 'AAPL' },
    ],
  });
  ok(near(flows['2026-01-06'], 800) && flows['2026-01-07'] === -200, 'תזרימים: הפקדה+המרה, משיכה שלילית');
  ok(!('2026-01-08' in flows), 'תזרימים: דיבידנד אינו תזרים חיצוני');

  // --- 9. תוויות ציר: בלי כפילויות (לפני: "12/2023 12/2023 12/2024 12/2024") ---
  const lbl = A('pfAxisLabels')(pRows.map((r) => r.date));
  const texts = lbl.map((l) => l.text);
  ok(texts.length === new Set(texts).size, 'תוויות: בלי כפילויות');
  ok(texts.length >= 2 && texts.length <= 4, 'תוויות: 2–4');
  const lblShort = A('pfAxisLabels')(daily.slice(-22).map((r) => r.date));
  ok(/^\d{2}\/\d{2}$/.test(lblShort[0].text) && lblShort[0].text.split('/')[1] === daily[daily.length - 22].date.slice(5, 7), 'תוויות בטווח קצר: יום/חודש');

  // --- 9ב. ציר X לפי זמן (תקופה של יום אחד לא תופסת רוחב של שנה) ---
  const tf = A('pfTimeFractions')(['2024-01-01', '2024-12-30', '2024-12-31', '2026-01-01']);
  ok(tf[0] === 0 && tf[3] === 1, 'ציר זמן: קצוות 0 ו־1');
  ok(tf[2] - tf[1] < 0.01, 'ציר זמן: יום אחד = רווח זעיר, לא רבע מהגרף');
  ok(JSON.stringify(A('pfTimeFractions')(['x', 'y', 'z'])) === JSON.stringify([0, 0.5, 1]), 'ציר זמן: תאריך לא תקין -> לפי אינדקס');

  // --- 10. מחרוזות חדשות בשתי השפות ---
  const S = A('STRINGS');
  for (const k of ['pfNoteIbkrDaily', 'pfRangeNeedsDaily']) ok(S.he[k] && S.en[k], k + ' בעברית ובאנגלית');
  ok(/Net Asset Value \(NAV\) in Base/.test(S.he.flexGuide) && /Net Asset Value \(NAV\) in Base/.test(S.en.flexGuide), 'המדריך ממליץ על מקטע NAV in Base');

  // --- 11. גרסאות ---
  const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(!!ver, 'APP_VERSION מוגדר');
  ok(sw.includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');

  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('נכשל:', e && e.stack || e); process.exit(1); });
