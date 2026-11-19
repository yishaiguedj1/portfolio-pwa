// cur-display.test.js — 19/11/2026: מטבע התצוגה חל על סכומים מצטברים בלבד; מחיר/הפקדה בודדת — במטבע שלהם
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const pick = (a, b) => app.slice(app.indexOf(a), app.indexOf(b));
const sb = { fxHistCache: null, num: (v) => Number(v) || 0, state: { fx: 4 }, isIbkrDeposit: (d) => !!d.ibkr,
  fxOnOrBefore: (iso) => (iso < '2026-01-01' ? 3.5 : 3.2) };
vm.createContext(sb);
vm.runInContext(pick('function depDateKey(', 'function depositsNewestFirst('), sb);
vm.runInContext(pick('function depositsNewestFirst(', '/* v147:'), sb);
vm.runInContext(pick('function depNative(', '/* סך הפקדות נטו'), sb);
vm.runInContext(pick('function depYearGroups(', 'function depMonthName('), sb);
const R = (c) => vm.runInContext(c, sb);
// הפקדת IBKR בדולר, הפקדה ידנית בשקלים (2025, שער 3.5) ומשיכה ידנית (2026, שער 3.2)
R(`var L = [{ ibkr: 1, date: '2026-03-10', cur: 'USD', amt: 1000, amount: -3200 }, { date: '10/05/2025', amount: -3500 }, { date: '2026-04-01', amount: 640 }]`);
ok(R("depInCur(L[0], 'USD')") === -1000, 'הפקדה בדולר בתצוגת דולר — הסכום המקורי, בלי המרה');
ok(R("depInCur(L[1], 'USD')") === -1000, 'הפקדה בשקלים בתצוגת דולר — לפי שער יום ההפקדה (גם בתאריך dd/mm/yyyy)');
ok(R("depInCur(L[2], 'USD')") === 200, 'משיכה בשקלים — לפי שער יומה');
ok(R("depInCur(L[1], 'ILS')") === -3500, 'תצוגת שקלים — כמו קודם (depILS)');
const g = R("depYearGroups(depositsNewestFirst(L), 'USD')");
ok(g[0].y === '2026' && g[0].sumIn === 1000 && g[0].sumOut === 200 && g[0].net === 800 && g[1].net === 1000, 'כרטיסי השנה במטבע התצוגה');
ok(R("depYearGroups(depositsNewestFirst(L))")[1].net === 3500, 'בלי מטבע — שקלים (תאימות)');
// מסך ההפקדות: בלי ₪ קבוע בסכומים המצטברים
const rd = pick('function renderDeposits(', 'function depYearsBar(');
ok(!/'₪'/.test(rd) && /depMoneyTxt\(nd, cur, 2\)/.test(rd) && /depYearGroups\(shown, cur\)/.test(rd), 'הסך והכרטיסים לפי state.currency, לא ₪ קבוע');
ok(/depositAmountHTML\(r\.amount, r\.nat\)/.test(rd), 'קנייה ידנית בשורה — במטבע המניה');
ok(/function depMoneyTxt\(v, cur, dec\)[\s\S]{0,200}cur === 'USD' \? '\$' : '₪'/.test(app), 'עיצוב הסכום לפי המטבע');
ok(/if \(state\.currency === 'ILS'\) return netDepositsILS\(\);[\s\S]{0,300}depInCur\(d, 'USD'\)/.test(app), 'בסיס הרווח בתצוגת דולר — הפקדות בדולר כמו שהן, לא דרך שקלים בשער של היום');
// מחיר למניה — תמיד במטבע המסחר
const px = pick('function fmtPx(', 'function fmtILS(');
ok(!/state\.currency/.test(px) && !/state\.fx/.test(px), 'fmtPx/fmtSignedPx: בלי המרה למטבע התצוגה');
ok(/return fmtUSD2\(v\);/.test(px) && /return ltrNum\(sg \+ fmtUSD2\(Math\.abs\(r\)\)\);/.test(px), 'מניה אמריקאית — תמיד $');
console.log('# cur-display: ' + n + ' בדיקות עברו');
