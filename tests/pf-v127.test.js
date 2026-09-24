// pf-v127.test.js — יום כפול בסנכרון המשך.
// באג (שוחזר 24/09/2026): סנכרון המשך התחיל מתאריך הסיום של הנתונים הקיימים;
// התקופה החדשה [T..X] והקיימת [..T] "נוגעות" ביום T, המיזוג לא ראה בהן חפיפה,
// שתיהן נשמרו — ויום T נספר פעמיים ברווח וב־TWR (19.26% -> 19.74% בסנכרון אחד).
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

// --- 1. סנכרון המשך מתחיל ביום שאחרי הנתונים הקיימים ---
const dflt = A('ibkrDefaultFromYmd');
ok(dflt({ meta: { toDate: '2026-09-23' } }) === '20260924', 'המשך: היום שאחרי 23/09');
ok(dflt({ meta: { toDate: '2026-09-30' } }) === '20261001', 'המשך: מעבר חודש');
ok(dflt({ meta: { toDate: '2025-12-31' } }) === '20260101', 'המשך: מעבר שנה');

// --- 2. אין מה למשוך כשנותרו רק ימי סופ"ש ---
const wk = A('ibkrHasWeekday');
ok(wk('20260926', '20260927') === false, 'שבת–ראשון: אין יום מסחר');
ok(wk('20260925', '20260927') === true, 'שישי–ראשון: יש יום חול');
ok(wk('20260924', '20260923') === false, 'טווח הפוך (כבר מעודכן): אין מה למשוך');

// --- 3. התרחיש שהתגלה: מיזוג סנכרון מלא + סנכרון המשך ---
const full = { navPeriods: [{ fromDate: '2026-01-01', toDate: '2026-09-23', startingValue: 60000, endingValue: 73324, netFlows: 5000, twr: 19.26 }] };
const oldInc = { navPeriods: [{ fromDate: '2026-09-23', toDate: '2026-09-24', startingValue: 73000, endingValue: 73012, netFlows: 0, twr: 0.4 }] };
const bad = R.rMergeData(full, oldInc);
ok(bad.navPeriods.length === 2 && R.rHeadlineTwr(bad) > 19.5, 'מתועד: התחלה מאותו יום = יום כפול (הבאג)');
const inc = { navPeriods: [{ fromDate: '2026-09-24', toDate: '2026-09-24', startingValue: 73324, endingValue: 73012, netFlows: 0, twr: -0.4255 }] };
const good = R.rMergeData(full, inc);
ok(good.navPeriods.length === 2, 'המשך מהיום שאחרי: שתי תקופות עוקבות');
ok(Math.abs(R.rGain(good) - (73012 - 60000 - 5000)) < 1e-9, 'רווח = סוף − התחלה − הפקדות, בלי יום כפול');
ok(Math.abs(R.rHeadlineTwr(good) - ((1.1926 * (1 - 0.004255) - 1) * 100)) < 1e-9, 'TWR משורשר בלי יום כפול');

// --- 4. תקופה קצרה בתוך תקופה קיימת לא מוחקת אותה ---
const p = (a, b, twr) => ({ fromDate: a, toDate: b, twr: twr });
const c1 = R.rMergePeriods([p('2025-01-01', '2025-12-31', 8)], [p('2025-12-31', '2025-12-31', 0.1)]);
ok(c1.periods.length === 1 && c1.periods[0].twr === 8 && c1.replaced.length === 0, 'יום בודד בתוך שנה קיימת: מדלגים, השנה נשמרת');
const c2 = R.rMergePeriods([p('2026-01-01', '2026-09-23', 19)], [p('2026-03-01', '2026-05-31', 2)]);
ok(c2.periods.length === 1 && c2.periods[0].twr === 19, 'טווח חלקי באמצע השנה: לא מחליף את התקופה הרחבה');
const c3 = R.rMergePeriods([p('2024-01-01', '2024-12-31', 10)], [p('2024-01-01', '2024-12-31', 12)]);
ok(c3.periods.length === 1 && c3.periods[0].twr === 12, 'אותו טווח עם ערכים מתוקנים: עדיין מחליף');
const c4 = R.rMergePeriods([p('2026-01-01', '2026-09-23', 19)], [p('2026-01-01', '2026-09-24', 19.5)]);
ok(c4.periods.length === 1 && c4.periods[0].toDate === '2026-09-24', 'טווח רחב יותר: מחליף');

// --- 5. הזרימה בסנכרון: הצעת השדה לא נשמרת כתאריך ידני קבוע ---
ok(/const isContinuation = hasData[\s\S]*?fromYmd === contYmd \|\| fromYmd === lastYmd/.test(src), 'ערך המשך בשדה (או תאריך הסיום הישן) = סנכרון המשך, לא תאריך ידני');
ok(/!ibkrHasWeekday\(startYmd, endYmd\)[\s\S]*?t\('ibkrUpToDate'\)/.test(src), 'כבר מעודכן: הודעה במקום בקשה ל־IBKR');
const S = A('STRINGS');
ok(S.he.ibkrUpToDate && S.en.ibkrUpToDate, 'ibkrUpToDate בעברית ובאנגלית');

// גרסאות
const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');

console.log('\n' + n + ' בדיקות עברו');
