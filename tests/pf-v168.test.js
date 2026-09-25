// pf-v168.test.js — תיק הדמו = העתק של תיק המניות של באפט (ברקשייר, דוחות 13F) + 3 מניות ומדד מת"א.
// מחירים סינתטיים בלבד (בלי רשת); הטבלה BRK_13F עצמה היא מידע ציבורי מה־SEC.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const sb = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }) }, window: {}, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(new Error('no net')), setTimeout, clearTimeout, console };
vm.createContext(sb); vm.runInContext(src, sb);
const A = (k) => vm.runInContext(k, sb);
const Q = A('BRK_13F_Q'), T = A('BRK_13F');
const today = '2026-09-25';

// --- 1. הטבלה ---
ok(Q.length >= 24 && Q[0] === '2020-09-30' && Q.every((d, i) => !i || d > Q[i - 1]) && Q.every((d) => /-(03-31|06-30|09-30|12-31)$/.test(d)), 'רבעונים רצופים מ־30/09/2020 (' + Q.length + ')');
const cur = Object.keys(T).filter((s) => (T[s][Q.length - 1] || 0) > 0);
ok(['AAPL', 'AXP', 'KO', 'BAC', 'CVX', 'OXY', 'GOOGL', 'CB', 'MCO', 'KHC'].every((s) => cur.includes(s)), 'האחזקות הגדולות של ברקשייר היום בטבלה');
ok(Object.values(T).every((r) => r.length <= Q.length && r.every((v) => Number.isInteger(v) && v >= 0)), 'ערכים שלמים, לא שליליים, לא יותר מהרבעונים');
const totLast = cur.reduce((a, s) => a + T[s][Q.length - 1], 0);
ok(totLast > 200000 && totLast < 450000, 'קנה מידה של תיק פרטי: ~$' + Math.round(totLast / 1000) + 'K');
ok(!('ATVI' in T) && !('BK' in T), 'בלי ניירות שנמחקו מ־Yahoo; BNY בשם החדש');

// --- 2. מחירים סינתטיים: לכל סימבול סדרה משלו ---
function series(start, mult, amp, from) {
  const out = []; const t = new Date((from || '2019-06-03') + 'T00:00:00Z'); let k = 0;
  for (;;) {
    const wd = t.getUTCDay();
    if (wd !== 0 && wd !== 6) {
      const iso = t.toISOString().slice(0, 10);
      if (iso > today) break;
      out.push({ date: iso, close: +(start * Math.pow(mult, k) * (1 + amp * Math.sin(k / 11))).toFixed(4) });
      k++;
    }
    t.setUTCDate(t.getUTCDate() + 1);
  }
  return out;
}
const hist = {};
Object.keys(T).forEach((s, k) => { hist[s] = series(20 + (k * 37) % 300, 1 + 0.0002 * ((k % 9) - 2), 0.05 + 0.01 * (k % 5)); });
hist['POLI.TA'] = series(22, 1.0008, 0.05); hist['ESLT.TA'] = series(600, 1.001, 0.06); hist['BEZQ.TA'] = series(4.5, 1.0003, 0.04);
const fxOf = (d) => (d < '2023-01-01' ? 3.3 : 3.6);
const tr = (k) => 'T:' + k;
const db = A('demoBuild')(hist, fxOf, 3.1, today, tr, 'he', { '207.TA': 3265.58 });
ok(db && db.demo === true && db.source === 'manual', 'דמו: מסומן דמו, מצב ידני');

// --- 3. העתק של ברקשייר ---
const us = db.positions.filter((p) => p.fromTrades);
const lastQ = Q[Q.length - 1];
const closeAt = (s, d) => A('closeOnOrBefore')(hist[s], d);
let mirror = true;
for (const s of cur) {
  const want = T[s][Q.length - 1] / closeAt(s, lastQ);
  const p = us.find((x) => x.sym === s);
  if (want < 0.5) { if (p) mirror = false; continue; }
  if (!p || Math.abs(p.shares - want) > Math.max(0.5, want * 0.005) + 0.5) { mirror = false; console.error('  ', s, p && p.shares, want); }
}
ok(mirror, 'אחזקות ארה"ב = הדוח האחרון של ברקשייר ÷ מיליון (כמות = שווי ÷ סגירה בסוף הרבעון)');
ok(us.every((p) => cur.includes(p.sym)), 'אין אחזקה במניה שברקשייר כבר מכרה');
const first = db.manualTrades.reduce((a, x) => (x.date < a ? x.date : a), '9999');
ok(first === '2020-09-30', 'העסקה הראשונה = סוף הרבעון הראשון (' + first + ')');
ok(db.manualTrades.every((x) => Q.some((q) => x.date <= q && x.date >= A('addDaysISO')(q, -10))), 'כל עסקה ביום המסחר האחרון של רבעון (כמו תאריך הדוח)');
ok(db.manualTrades.filter((x) => x.side === 'SELL').length > 10 && db.manualTrades.some((x) => x.sym === 'AAPL' && x.side === 'SELL'), 'גם מכירות (למשל אפל)');
let bad = 0;
for (const x of db.manualTrades) { const r = A('mtValidate')(db.manualTrades.filter((y) => y !== x), x, null, today); if (r && r.err) bad++; }
ok(bad === 0, 'כל ' + db.manualTrades.length + ' העסקאות עוברות את הוולידציה של הטופס');
ok(us.every((p) => !A('mtOversold')(db.manualTrades, p.sym)) && db.manualTrades.every((x) => x.date <= today), 'אין מכירה של יותר ממה שמוחזק, אין עסקה עתידית');

// TWR של הדמו מול חישוב עצמאי של "תיק 13F": האחזקות של כל רבעון מוחזקות עד הרבעון הבא
const rows = A('manualTwrRows')(db.manualTrades, (s) => hist[s] || [], fxOf);
const i0 = A('demoFirstQuarter')(today);
const sh = A('demoCloneShares')(hist, i0);
let idx = 1;
for (let k = 0; i0 + k < Q.length; k++) {
  const a = Q[i0 + k], b = i0 + k + 1 < Q.length ? Q[i0 + k + 1] : today;
  let va = 0, vb = 0;
  for (const s of Object.keys(sh)) { const q = sh[s][k]; if (!q) continue; va += q * closeAt(s, a); vb += q * closeAt(s, b); }
  if (va > 0) idx *= vb / va;
}
const twr = rows[rows.length - 1].value / rows[0].value;
ok(Math.abs(twr / idx - 1) < 0.004, 'TWR של הדמו = תיק 13F מחושב בנפרד (' + ((twr - 1) * 100).toFixed(2) + '% מול ' + ((idx - 1) * 100).toFixed(2) + '%)');

// --- 4. עיגול יציב: אחזקה שלא השתנתה = אין עסקה ---
T.ZZTEST = [1000, 1000, 1000, 1500];
hist.ZZTEST = series(100, 1, 0);
const z = A('demoCloneShares')(hist, 0).ZZTEST;
ok(z[0] === 10 && z[1] === 10 && z[2] === 10 && z[3] === 15 && z[4] === 0, 'עיגול יציב: אותו שווי ומחיר = אותה כמות; עלייה = קנייה; יציאה = 0');
hist.ZZTEST = series(100, 1.00001, 0);
const z2 = A('demoCloneShares')(hist, 0).ZZTEST;
ok(z2[0] === z2[1] && z2[1] === z2[2], 'שינוי זעיר במחיר (רעש) לא יוצר עסקה');
delete T.ZZTEST; delete hist.ZZTEST;
ok(A('demoFirstQuarter')('2026-09-25') === 0 && A('demoFirstQuarter')('2027-03-15') === 1, 'הרבעון הראשון זז עם הזמן — תמיד 6 שנים');

// --- 5. הפקדות, מזומן, ישראל ---
ok(db.deposits.length < 40 && db.deposits.some((d) => d.amount < 0) && db.deposits.some((d) => d.amount > 0), 'הפקדות לפי הצורך ומשיכות אחרי מכירות (' + db.deposits.length + ')');
ok(db.deposits[db.deposits.length - 1].place === 'T:demoReservePlace', 'ההפקדה הראשונה = הפקדה פותחת');
ok(db.deposits.every((d) => /^\d{2}\/\d{2}\/\d{4}$/.test(d.date) && !A('isIbkrDeposit')(d)), 'הפקדות ידניות (DD/MM/YYYY)');
ok(db.cash.usd >= 0 && db.cash.ils >= 0, 'מזומן לא שלילי');
const il = db.positions.filter((p) => /\.TA$/.test(p.sym));
ok(il.length === 4 && il.every((p) => !p.fromTrades && p.src === 'manual'), '3 מניות ומדד מת"א — "לפי ממוצע" (לא נכנסות ל־TWR)');
ok(il.some((p) => p.sym === 'POLI.TA') && il.some((p) => p.sym === '207.TA' && p.name === 'T:demoNameDefense' && p.avg === 3265.58), 'בנק הפועלים ומדד ת"א ביטחוניות (במחיר של היום)');
ok(!db.manualTrades.some((x) => /\.TA$/.test(x.sym)), 'אין עסקאות בישראליות — התשואה נשארת של באפט');
const poli = il.find((p) => p.sym === 'POLI.TA');
ok(poli.avg === Math.round(A('demoRowFrom')(hist['POLI.TA'], '2021-03-01').close * 100) / 100, 'מחיר הקנייה = סגירה אמיתית ביום הקנייה');
const dbNoIdx = A('demoBuild')(hist, fxOf, 3.1, today, tr, 'he', {});
ok(!dbNoIdx.positions.some((p) => p.sym === '207.TA'), 'בלי מחיר חי למדד — בלי המדד (לא ממציאים מחיר)');
ok(db.wishlist.length === 1 && db.wishlist[0].sym === 'BRK-B', 'במעקב: המניה של ברקשייר להשוואה');
ok(db.pensionFunds.length === 4 && db.pensionDeposits.length === 24, 'פנסיה והשתלמות כמו קודם');
ok(A('demoBuild')({}, fxOf, 3, today, tr, 'he', {}) === null, 'בלי נתוני שוק: null (הודעת שגיאה, לא תיק ריק)');

// --- 6. היסטוריה רזה ---
const trim = A('demoTrimSold')(hist.AAPL, '2021-06-30', '2022-06-30');
ok(trim[0].date >= '2021-06-10' && trim[trim.length - 1].date <= '2022-07-05' && trim.length > 250, 'מניה שנמכרה: היסטוריה רק סביב תקופת ההחזקה');
ok(/soldTo\[sym\]\) \{ restoreHistRows\(sym, rec\); syms\.delete\(sym\); \}/.test(src), 'מניה שנמכרה: לא נמשכת מחדש כל יום אם המטמון מכסה עד המכירה');
ok(/POSITIONS\.concat\(WISHLIST, DB\.manualTrades \|\| \[\]\)/.test(src), 'יציאה מהדמו: מנקה גם את ההיסטוריה של מה שנמכר');
const slim = A('histSlimForDemo')([{ date: '2015-01-02', close: 1, open: 1 }, { date: '2026-09-01', close: 12.345678, open: 1 }]);
ok(slim.length === 1 && Object.keys(slim[0]).join() === 'date,close', 'היסטוריה בדמו: 7 שנים, תאריך + סגירה');
ok(/for \(let i = 0; i < syms\.length; i \+= 40\) parts\.push/.test(src), 'עד 40 סימבולים לבקשה לשרתון (מגבלת השרתון)');

// --- 7. מדד ת"א: נקודות, לא אגורות ---
ok(A('isTaseIndex')('207.TA') && !A('isTaseIndex')('POLI.TA') && !A('isTaseIndex')('1233170.TA') && !A('isTaseIndex')('AAPL'), 'מדד ת"א = סימבול מספרי קצר');
vm.runInContext('state.lang = "he"', sb);
ok(A('fmtAg')(3265.58, '207.TA') === '⁧3,265.58 נק׳⁩' && A('fmtAg')(78.3, 'POLI.TA') === '⁧7,830 אג׳⁩', 'מדד בנקודות ("3,265.58 נק׳"), מניה באגורות');
ok(A('pxInFactor')('207.TA') === 1 && A('pxInFactor')('POLI.TA') === 100, 'הזנת מחיר למדד — בנקודות');
ok(A('demoStockName')('KO', 'he') === 'Coca-Cola' && A('demoStockName')('POLI.TA', 'he') === 'הפועלים', 'שמות');
console.log('\n' + n + ' בדיקות עברו');
