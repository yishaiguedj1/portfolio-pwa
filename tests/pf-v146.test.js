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

// --- 4. תיק דמו: מ־v168 העתק של תיק באפט — הבדיקות ב־pf-v168.test.js ---

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
