// pf-v146.test.js — תיק חדש ריק, ניקוי רשומות הדוגמה הישנות, איפוס נפרד ידני/IBKR,
// ותיק דמו שנבנה מעסקאות. נתונים סינתטיים בלבד.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const cloudSrc = fs.readFileSync(path.join(root, 'cloud.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

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
const cp = (o) => JSON.parse(JSON.stringify(o));

// --- 1. תיק חדש ריק ---
const def = A('DEFAULT_DB');
ok(def.positions.length === 0 && def.deposits.length === 0 && def.pensionFunds.length === 0 &&
  def.pensionDeposits.length === 0 && def.wishlist.length === 0, 'ברירת מחדל: אין מניות/הפקדות/פנסיה/מעקב');
ok(def.cash.usd === 0 && def.cash.ils === 0, 'ברירת מחדל: אין מזומן');
ok(A('demoDb')().positions.length === 0, 'demoDb (תיק למשתמש חדש בענן) — ריק');
ok(A('DB').positions.length === 0, 'טעינה ראשונה בלי נתונים — תיק ריק');

// --- 2. ניקוי רשומות הדוגמה הישנות ---
const strip = A('stripLegacyDemo');
const legacy = {
  v: 1, source: 'ibkr',
  positions: [
    { sym: 'GOOGL', name: 'גוגל', full: 'Alphabet Inc', shares: 10, avg: 140 },
    { sym: 'META', name: 'מטא', full: 'Meta Platforms Inc', shares: 5, avg: 480 },
    { sym: 'META', name: 'Meta', shares: 5, avg: 480.12 },                 // אמיתי — נשאר
    { sym: 'GOOGL', name: 'גוגל', shares: 10, avg: 140, src: 'manual' },   // סומן ידני — נשאר
  ],
  deposits: [
    { date: '01/01/2026', amount: -1000, place: 'הפקדת דוגמה' },
    { date: '2023-09-28', amount: -6299.83, place: 'TRANSFER' },
    { date: '01/01/2026', amount: -1000, place: 'הפקדה שלי' },            // אמיתי — נשאר
  ],
  pensionFunds: [{ name: 'פנסיה — מקום עבודה', usd: 0, ils: 1000 }, { name: 'הפנסיה שלי', usd: 0, ils: 1000 }],
  cash: { usd: 100, ils: 100 },
  ibkrSnapshot: { positions: [{ sym: 'GOOGL', name: 'גוגל', shares: 10, avg: 140 }], deposits: [{ date: '01/01/2026', amount: -1000, place: 'הפקדת דוגמה' }] },
};
ok(strip(legacy) === true, 'מזהה רשומות דוגמה ישנות');
ok(legacy.deposits.length === 2 && !legacy.deposits.some((d) => d.place === 'הפקדת דוגמה'), 'ההפקדה ₪1,000 "הפקדת דוגמה" נמחקה, הפקדות אמיתיות נשארו');
ok(legacy.positions.length === 2 && legacy.positions.some((p) => p.avg === 480.12) && legacy.positions.some((p) => p.src === 'manual'),
  'מניות הדוגמה (טביעת אצבע מדויקת) נמחקו — מניות אמיתיות וידניות נשארו');
ok(legacy.pensionFunds.length === 1 && legacy.pensionFunds[0].name === 'הפנסיה שלי', 'קרן הדוגמה נמחקה, קרן אמיתית נשארה');
ok(legacy.cash.usd === 100, 'מצב IBKR: המזומן מהדוח לא נוגעים');
ok(legacy.ibkrSnapshot.positions.length === 0 && legacy.ibkrSnapshot.deposits.length === 0, 'גם בצילום שלפני IBKR (שחזור בניתוק)');
ok(strip(legacy) === false, 'אידמפוטנטי — ריצה שנייה לא משנה');
const manualLegacy = { deposits: [{ date: '01/01/2026', amount: -1000, place: 'הפקדת דוגמה' }], positions: [], pensionFunds: [], cash: { usd: 100, ils: 100 } };
strip(manualLegacy);
ok(manualLegacy.cash.usd === 0 && manualLegacy.cash.ils === 0, 'מצב ידני עם טביעת הדוגמה: המזומן 100/100 מתאפס');

// --- 3. שני מאגרים: איפוס ידני מול IBKR ---
ok(A('isIbkrDeposit')({ date: '2023-09-28', amount: -5 }) && A('isIbkrDeposit')({ date: '01/02/2026', src: 'ibkr' }) &&
  !A('isIbkrDeposit')({ date: '01/02/2026', amount: -5 }), 'הפקדת IBKR: תג src או תאריך ISO; ידנית: DD/MM/YYYY');
ok(/place: String\(c\.description[^\n]+\n\s+src: 'ibkr',/.test(src), 'ibkrMapDeposits מתייג src:ibkr');
const mixed = () => ({
  source: 'ibkr',
  positions: [{ sym: 'AAA', shares: 1, avg: 1 }, { sym: 'MAN', shares: 2, avg: 2, src: 'manual', fromTrades: true }],
  deposits: [{ date: '2024-01-02', amount: -100, src: 'ibkr' }, { date: '2023-05-05', amount: -50 }, { date: '01/03/2026', amount: -20 }],
  manualTrades: [{ id: 'x', date: '2026-01-02', sym: 'MAN', side: 'BUY', qty: 2, price: 2 }],
  pensionFunds: [{ name: 'P', ils: 5 }], pensionDeposits: [{ amount: -1 }],
  wishlist: [{ sym: 'WWW' }], cash: { usd: 10, ils: 20 }, ibkrSnapshot: { positions: [] },
});
const m = mixed();
A('resetManualData')(m, true);
ok(m.positions.length === 1 && m.positions[0].sym === 'AAA', 'איפוס ידני: מניות IBKR נשארות, ידניות נמחקות');
ok(m.deposits.length === 2 && m.deposits.every(A('isIbkrDeposit')), 'איפוס ידני: הפקדות IBKR נשארות, ידניות נמחקות');
ok(m.manualTrades.length === 0 && m.pensionFunds.length === 0 && m.pensionDeposits.length === 0, 'איפוס ידני: עסקאות ידניות ופנסיה נמחקו');
ok(m.wishlist.length === 1 && m.cash.usd === 10 && m.source === 'ibkr', 'איפוס ידני: מעקב, מזומן IBKR ומצב IBKR נשארים');
const i = mixed();
A('resetIbkrData')(i, true);
ok(i.positions.length === 1 && i.positions[0].sym === 'MAN', 'איפוס IBKR: רק הידניות נשארות');
ok(i.deposits.length === 1 && i.deposits[0].date === '01/03/2026', 'איפוס IBKR: רק הפקדות ידניות נשארות');
ok(i.manualTrades.length === 1 && i.pensionFunds.length === 1, 'איפוס IBKR: עסקאות ידניות ופנסיה נשארות');
ok(i.cash.usd === 0 && i.source === 'manual' && !i.ibkrSnapshot, 'איפוס IBKR: מזומן הדוח מתאפס, עוברים למצב ידני');
const man = { positions: [{ sym: 'Q', shares: 1, avg: 1 }], deposits: [{ date: '01/01/2025', amount: -9 }], manualTrades: [], pensionFunds: [], pensionDeposits: [], cash: { usd: 5, ils: 5 } };
A('resetManualData')(man, false);
ok(man.positions.length === 0 && man.deposits.length === 0 && man.cash.usd === 0, 'מצב ידני: איפוס ידני מנקה הכל כולל מזומן');

// --- 4. תיק דמו (v161: 6 שנים, מניות ומדדים מארה"ב ומישראל, פנסיה והשתלמות) ---
const today = '2026-09-25';
function series(start, mult, from) { // מחיר שעולה בהדרגה עם גלים — ימי חול בלבד, מ־from עד היום
  const out = []; const t = new Date((from || '2019-06-03') + 'T00:00:00Z');
  let k = 0;
  for (;;) {
    const wd = t.getUTCDay();
    if (wd !== 0 && wd !== 6) {
      const iso = t.toISOString().slice(0, 10);
      if (iso > today) break;
      out.push({ date: iso, close: +(start * Math.pow(mult, k) * (1 + 0.08 * Math.sin(k / 9))).toFixed(2) });
      k++;
    }
    t.setUTCDate(t.getUTCDate() + 1);
  }
  return out;
}
const hist = {};
const us = A('DEMO_US'), ta = A('DEMO_TA'), hot = A('DEMO_HOT');
us.forEach((s, k) => { hist[s] = series(50 + k * 7, 1 + 0.0004 * (k % 7 + 1)); });
ta.forEach((s, k) => { hist[s] = series(30 + k * 5, 1 + 0.0005 * (k + 1)); });
hist.TSLA = series(900, 0.9995); // יורדת — לא "לוהטת"
hist.NFLX = series(300, 1.0004, '2023-01-02'); // היסטוריה קצרה — לא נכנסת לתוכנית 6 השנים
const rank = A('demoPickHot')(hist, hot, 5, today);
ok(rank.length === 5 && !rank.includes('TSLA'), 'בחירה: מניה בירידה לא נבחרת');
const picks = A('demoPicks')(hist, today);
ok(!picks.plan.includes('NFLX') && picks.plan.includes('SPY') && picks.plan.includes('ESLT.TA'), 'בלי היסטוריה של 6 שנים — לא בתוכנית');
ok(picks.hot.length === 2 && picks.watch.length === 3, 'שתי "לוהטות" ושלוש למעקב');
const fxOf = (d) => (d < '2026-01-01' ? 3.6 : 3.3);
const db = A('demoBuild')(hist, picks, fxOf, 3.1, today, (k) => 'T:' + k, 'he');
ok(db && db.demo === true && db.source === 'manual', 'דמו: מסומן דמו, מצב ידני');
const first = db.manualTrades.reduce((a, x) => (x.date < a ? x.date : a), '9999');
ok(first <= '2020-10-15' && first >= '2020-09-20', 'דמו: העסקה הראשונה לפני ~6 שנים (' + first + ')');
ok(db.positions.length >= 20 && db.positions.every((p) => p.src === 'manual' && p.fromTrades), 'דמו: ' + db.positions.length + ' אחזקות, כולן לפי עסקאות');
ok(db.positions.filter((p) => /\.TA$/.test(p.sym)).length === 8, 'דמו: 8 מניות ישראליות');
ok(['SPY', 'QQQ', 'EIS'].every((s) => db.positions.some((p) => p.sym === s)), 'דמו: מדדים — S&P 500, נאסד"ק 100, ישראל');
ok(db.positions.find((p) => p.sym === 'SPY').name === 'T:demoNameSpy', 'דמו: שם מדד מתורגם');
ok(db.manualTrades.filter((x) => x.sym === 'SPY').length >= 11, 'דמו: חיסכון חצי־שנתי במדד (' + db.manualTrades.filter((x) => x.sym === 'SPY').length + ' קניות)');
ok(db.manualTrades.some((x) => x.side === 'SELL') && db.manualTrades.some((x) => x.side === 'BUY'), 'דמו: קניות וגם מכירות');
const years = new Set(db.manualTrades.map((x) => x.date.slice(0, 4)));
ok(years.size >= 6, 'דמו: עסקאות בכל שנה (' + [...years].sort().join(',') + ')');
let bad = 0;
for (const x of db.manualTrades) { const r = A('mtValidate')(db.manualTrades.filter((y) => y !== x), x, null, today); if (r && r.err) bad++; }
ok(bad === 0, 'דמו: כל העסקאות עוברות את הוולידציה של הטופס (תאריך, כמות, מחיר)');
ok(db.positions.every((p) => !A('mtOversold')(db.manualTrades, p.sym)), 'דמו: אין מכירה של יותר ממה שמוחזק');
ok(db.manualTrades.every((x) => x.date <= today), 'דמו: אין עסקה עתידית');
for (const p of db.positions) {
  const st = A('mtPosition')(db.manualTrades, p.sym);
  if (Math.abs(st.shares - p.shares) > 1e-9 || Math.abs(st.avg - p.avg) > 1e-9) { ok(false, 'דמו: כמות/ממוצע נגזרים מהעסקאות — ' + p.sym); }
}
ok(true, 'דמו: כמות וממוצע של כל מניה = החישוב מהעסקאות');
ok(db.deposits.some((d) => d.amount < 0) && db.deposits.some((d) => d.amount > 0), 'דמו: הפקדות וגם משיכות');
ok(db.deposits.every((d) => /^\d{2}\/\d{2}\/\d{4}$/.test(d.date) && !A('isIbkrDeposit')(d)), 'דמו: הפקדות ידניות (DD/MM/YYYY), לא IBKR');
ok(db.cash.usd > 0 && db.cash.ils > 0, 'דמו: מזומן בדולרים וגם בשקלים');
const last = (s) => hist[s][hist[s].length - 1].close;
let valUsd = db.cash.usd + db.cash.ils / 3.1;
for (const p of db.positions) valUsd += p.shares * last(p.sym) / (/\.TA$/.test(p.sym) ? 3.1 : 1);
const depIls = -db.deposits.reduce((a, d) => a + d.amount, 0);
const ret = valUsd * 3.1 / depIls - 1;
ok(ret > 0.05, 'דמו: תשואה חיובית מול ההפקדות (' + (ret * 100).toFixed(1) + '%)');
ok(db.positions.every((p) => last(p.sym) > p.avg), 'דמו: כל מניה ברווח');
ok(db.pensionFunds.length === 4 && db.pensionFunds.filter((f) => f.kind === 'study').length === 2, 'דמו: 2 קרנות פנסיה + 2 קרנות השתלמות');
ok(db.pensionDeposits.length === 24 && new Set(db.pensionDeposits.map((d) => d.period)).size === 6, 'דמו: הפקדה לכל קרן בכל אחת מ־6 השנים');
for (const f of db.pensionFunds) {
  const dep = -db.pensionDeposits.filter((d) => d.place === f.name).reduce((a, d) => a + d.amount, 0);
  if (!(f.ils > dep)) ok(false, 'דמו: שווי הקרן גבוה מההפקדות — ' + f.name);
}
ok(true, 'דמו: כל קרן שווה יותר מסך ההפקדות אליה');
ok(db.wishlist.length === 3, 'דמו: רשימת מעקב');
ok(db.deposits[0].place.startsWith('T:') && db.pensionFunds[0].name.startsWith('T:'), 'דמו: טקסטים דרך תרגום (עברית/אנגלית)');
const slim = A('histSlimForDemo')([{ date: '2015-01-02', close: 1, open: 1, high: 1, low: 1, volume: 5 }, { date: '2026-09-01', close: 12.345678, open: 1, high: 2, low: 0.5, volume: 9 }]);
ok(slim.length === 1 && Object.keys(slim[0]).join() === 'date,close' && slim[0].close === 12.3457, 'דמו: היסטוריה נחתכת ל־7 שנים ונשמרת רזה (תאריך + סגירה) — לא ממלאים את הזיכרון בטלפון');
ok(/if \(isDemoMode\(\)\) rows = histSlimForDemo\(rows\);/.test(src) && /if \(demoLong\) rows = histSlimForDemo\(rows\);/.test(src), 'דמו: שני מסלולי השמירה רזים');
ok(A('demoStockName')('TEVA.TA', 'he') === 'טבע' && A('demoStockName')('ANET', 'he') === 'Arista Networks', 'דמו: שמות מניות');
ok(A('demoBuild')({}, { plan: [], hot: [] }, fxOf, 3, today, (k) => k, 'he') === null, 'דמו בלי נתוני שוק: null (הודעת שגיאה, לא תיק ריק)');

// --- 5. מצב דמו לא נכתב לענן ולא נדרס ממנו ---
ok(/function scheduleSave\(\) \{\n\s+if \([^)]*demoOn\(\)\) return;/.test(cloudSrc), 'ענן: לא שומרים במצב דמו (scheduleSave)');
ok(/async function flushSave\(\) \{\n\s+if \([^)]*demoOn\(\)\) return;/.test(cloudSrc), 'ענן: לא שומרים במצב דמו (flushSave)');
ok(/if \(demoOn\(\)\) \{[\s\S]{0,200}\} else if \(snap\.exists/.test(cloudSrc), 'ענן: בטעינה במצב דמו לא דורסים את הדמו');
ok(/stripLegacyDemo\(DB\)/.test(cloudSrc), 'ענן: מנקה רשומות דוגמה ישנות שנשמרו בענן');
ok(/localStorage\.setItem\(LS_PREDEMO, JSON\.stringify\(DB\)\)/.test(src) && /Cloud\.flushSave\(\)[\s\S]{0,120}LS_PREDEMO/.test(src),
  'לפני דמו: שמירה אחרונה לענן + גיבוי מקומי של הנתונים האמיתיים');
ok(/if \(isDemoMode\(\)\) return ibkrShowErr\(t\('demoSyncBlocked'\)\)/.test(src), 'סנכרון IBKR חסום במצב דמו');

// --- 6. HTML ---
ok(html.indexOf('id="demoOffer"') > -1 && html.indexOf('id="demoOffer"') < html.indexOf('id="accountCard"'), 'הצעת הדמו בראש ההגדרות');
ok(/id="resetManual"/.test(html) && /id="resetIbkr"/.test(html) && /id="resetData"/.test(html), 'שלושה כפתורי איפוס: ידני, IBKR, מלא');
ok(/id="demoBanner"/.test(html), 'באנר מצב דמו');

const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');
console.log('\n' + n + ' בדיקות עברו');
