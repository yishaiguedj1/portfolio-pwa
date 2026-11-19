// dep-years.test.js — 15/11/2026: ההפקדות בכרטיסי שנה (אקורדיון זכוכית) במקום רשימה אחת ארוכה
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
// רק הפונקציות הטהורות — בלי להריץ את כל האפליקציה
const pick = (a, b) => app.slice(app.indexOf(a), app.indexOf(b));
const sb = { fxHistCache: null, num: (v) => Number(v) || 0 };
vm.createContext(sb);
vm.runInContext(pick('function depDateKey(', 'function depositsNewestFirst('), sb);
vm.runInContext(pick('function depositsNewestFirst(', '/* v147:'), sb);
vm.runInContext(pick('function depILS(', '/* סך הפקדות נטו'), sb);
vm.runInContext(pick('function depYearGroups(', 'const depNetTxt'), sb);
vm.runInContext(pick('function depShortDate(', 'function buildDepositRow('), sb);
const R = (c) => vm.runInContext(c, sb);
const g = R(`depYearGroups(depositsNewestFirst([
  { date: '03/01/2025', amount: -1000 }, { date: '2026-02-10', amount: -500 }, { date: '20/06/2025', amount: 300 },
  { date: '', amount: -7 }, { date: '01/12/2026', amount: -250.5 }]))`);
ok(g.map((x) => x.y).join() === '2026,2025,—', 'קבוצה לכל שנה, מהחדשה לישנה; בלי תאריך — בסוף');
ok(g[0].items.length === 2 && g[0].items[0].d.date === '01/12/2026', 'בתוך השנה — מהחדשה לישנה, עם האינדקס המקורי');
ok(g[0].net === 750.5 && g[1].net === 700 && g[2].net === 7, 'נטו לשנה בשקלים (משיכה מקטינה)');
ok(g[0].months.map((m) => m.m + ':' + m.items.length + ':' + m.net).join() === '12:1:250.5,02:1:500' && g[1].months.map((m) => m.m).join() === '06,01', 'קטלוג חודשים בתוך השנה, מהחדש לישן, עם נטו לחודש');
ok(g[2].months[0].m === '', 'בלי תאריך — בלי כותרת חודש');
ok(/'dep-mo'/.test(app) && /!r\.classList\.contains\('dep-mo'\)/.test(app), 'כותרת חודש בכרטיס, ולא נספרת כשורה במקלדת');
ok(g[1].items.every((x) => typeof x.i === 'number'), 'האינדקס המקורי נשמר לעריכה/מחיקה');
ok(/groups\.forEach\(\(g, k\) => ul\.appendChild\(buildDepYear\(g, yrOpen\.has\(g\.y\) \? yrOpen\.get\(g\.y\) : k === 0/.test(app), 'ברירת מחדל: השנה האחרונה פתוחה, ומה שהמשתמש פתח נשמר בין ציורים');
ok(/:scope > \.dep-yr\.open/.test(app), 'אקורדיון — פתיחת שנה סוגרת את האחרות');
ok(/aria-expanded/.test(pick('function buildDepYear(', 'function buildDepositRow(')), 'נגישות: aria-expanded על כותרת השנה');
ok(/p\.matches\('\.dep-yr\.open'\)/.test(app), 'מקלדת במחשב: שורות של שנה פתוחה נספרות, של סגורה — לא');
ok(/\.rows li\.dep-yr \{[^}]*background: var\(--gl-card\)/.test(css) && /\.dep-yr-body \{[^}]*grid-template-rows: 0fr/.test(css), 'עיצוב: כרטיס זכוכית כמו בעסקאות ופתיחה חלקה');
ok(/\.dep-yr-in \{[^}]*padding-inline/.test(css), 'יישור לוגי בלבד');
ok(g[1].nIn === 1 && g[1].nOut === 1 && g[1].sumIn === 1000 && g[1].sumOut === 300, 'אריחי השנה: הפקדות ומשיכות בנפרד');
ok(R("depIsOut({ amount: 300 })") && !R("depIsOut({ amount: -300 })") && R("depIsOut({ amount: 0, cur: 'USD', amt: 50 })") && !R("depIsOut({ amount: 0, cur: 'USD', amt: -50 })"), 'משיכה מול הפקדה (גם במטבע זר בלי סכום בשקלים)');
ok(R("depShortDate({ date: '29/10/2026' })") === '29/10' && R("depShortDate({ date: '2026-03-05' })") === '05/03', 'תאריך קצר בשורה — השנה והחודש בכותרות');
const row = pick('function buildDepositRow(', '/* טופס עריכת הפקדה');
ok(/dir="auto"/.test(row) && /\.dep-note \{[^}]*text-overflow: ellipsis/.test(css), 'הערה בשורה אחת, לועזית נחתכת בסופה');
ok(/if \(ed\)[\s\S]*'dep-ed'/.test(row) && /const ed = !isIbkrMode\(\);/.test(app), 'עיפרון בכל שורה במצב ידני; IBKR — לקריאה בלבד');
ok(!/editDepositsBtn/.test(app) && /id="depAddBtn"/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')), 'בלי מצב עריכה — "+" בשורת הכלים');
ok(/'mini-btn danger', t\('btnDeleteRow'\)/.test(pick('function showEditDepositForm(', 'function showAddDepositForm(')), 'מחיקה מתוך טופס העריכה');
// 19/11/2026: שבבי שנה כמו בעסקאות, וכרטיס/חודש/שורה באותו עיצוב
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(/<div class="dep-bar">[\s\S]*?<div class="tx-years dep-years hidden" id="depYears" role="group"/.test(html), 'שבבי השנים בשורת הכלים, באותו רכיב כמו בעסקאות');
const bar = pick('function depYearsBar(', 'function depYearGroups(');
ok(/class="tx-y'/.test(bar) && /t\('txAll'\)/.test(bar) && /groups\.length > 1/.test(bar) && /y = state\._depY = 'all'/.test(bar), 'שבבים: "הכל" + שנה עם מספר רשומות; שנה אחת — בלי שבבים; שנה שנעלמה בסינון — חזרה ל"הכל"');
ok(/else ul\.appendChild\(buildDepYear\(groups\.find\(\(g\) => g\.y === selY\), true/.test(app), 'שנה נבחרת — רק הכרטיס שלה, פתוח');
const yr = pick('function buildDepYear(', 'function buildDepositRow(');
ok(/'tx-yr-h dep-yr-h'/.test(yr) && /tx-yr-top/.test(yr) && /tx-kv/.test(yr) && /TX_CHEV/.test(yr) && /depKvIn/.test(yr) && /depKvOut/.test(yr) && /depKvNet/.test(yr), 'כותרת השנה כמו בעסקאות: שנה, רשומות, חץ, והפקדות/משיכות/נטו');
ok(/\.rows li\.dep-mo \{[^}]*padding: 10px 16px 2px;[^}]*font-size: 12px; font-weight: 700/.test(css) && /\.dep-yr-list > li\.dep-row \+ li\.dep-row \{ border-top/.test(css), 'חודשים ושורות כמו בעסקאות (tx-mo, קו רק בין שורות צמודות)');
console.log('# dep-years: ' + n + ' בדיקות עברו');
