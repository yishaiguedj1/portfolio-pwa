// pf-v143.test.js — אימות לוגי של ה־TWR המשולב (IBKR + עסקאות ידניות).
// שאלת המשתמש (25/09/2026): האם השינוי בתשואות עם/בלי מניה ידנית נכון, ולמה
// ה־YTD כמעט לא זז. בדיקה בלתי־תלויה מול זהויות מתמטיות — נתונים סינתטיים בלבד.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const retSrc = fs.readFileSync(path.join(root, 'returns.js'), 'utf8');

let n = 0;
function ok(cond, name) {
  n++;
  if (!cond) { console.error('FAIL - ' + name); process.exit(1); }
  console.log('ok - ' + name);
}
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-9);

const sb = {
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { hidden: false, addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, style: {} }) },
  window: {}, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(new Error('no net')),
  setTimeout, clearTimeout, console: { log() {}, warn() {}, error: console.error },
};
vm.createContext(sb);
vm.runInContext(retSrc, sb);
vm.runInContext(src, sb);
const rows = vm.runInContext('rowsWithManualTwr', sb);

// ימי מסחר סינתטיים
const days = [];
const d0 = Date.UTC(2025, 3, 1);
for (let i = 0; days.length < 120; i++) {
  const d = new Date(d0 + i * 86400000);
  if (d.getUTCDay() % 6 !== 0) days.push(d.toISOString().slice(0, 10));
}
// תיק IBKR: תשואה יומית משתנה (דטרמיניסטית), מניה ידנית: מסלול אחר
const rI = (i) => 0.002 + 0.01 * Math.sin(i / 7);
const px = (i) => 100 * Math.exp(0.004 * i + 0.05 * Math.cos(i / 5));

function build(flowsAt) {
  const nav = [], base = [];
  let N = 50000, idx = 100;
  for (let i = 0; i < days.length; i++) {
    if (i > 0) { N *= 1 + rI(i); idx *= 1 + rI(i); }
    const f = (flowsAt && flowsAt[days[i]]) || 0;
    N += f;
    nav.push({ date: days[i], total: N });
    base.push({ date: days[i], value: idx });
  }
  return { nav, base };
}
const hist = days.map((d, i) => ({ date: d, close: px(i) }));

// --- 1. זהות קנה־והחזק: בלי תזרימים אחרי הקנייה, התשואה המשולבת מיום הקנייה
//        = (שווי IBKR + שווי ידני בסוף) / (שניהם ביום הקנייה) ---
{
  const { nav, base } = build(null);
  const b = 20, qty = 30;
  const out = rows(base, nav, {}, [{ id: 'x', date: days[b], sym: 'MAN', side: 'BUY', qty, price: px(b), fee: 0 }], () => hist, () => 1);
  const iEnd = days.length - 1;
  const lhs = out[iEnd].value / out[b].value;
  const rhs = (nav[iEnd].total + qty * px(iEnd)) / (nav[b].total + qty * px(b));
  ok(near(lhs, rhs, 1e-9), 'קנה־והחזק: TWR משולב = יחס השווי הכולל (' + ((lhs - 1) * 100).toFixed(3) + '%)');
  ok(near(out[b].value / out[b - 1].value, base[b].value / base[b - 1].value, 1e-12), 'יום הקנייה במחיר הסגירה: אין קפיצה — רק תשואת IBKR');
  ok(near(out[b - 1].value, base[b - 1].value), 'לפני הקנייה: בדיוק הסדרה הרשמית');
}

// --- 2. הפקדה ל־IBKR באמצע לא נספרת כרווח (גם עם מניה ידנית) ---
{
  const dep = {}; dep[days[60]] = 20000;
  const A = build(null), B = build(dep);
  const flows = {}; flows[days[60]] = 20000;
  const tr = [{ id: 'x', date: days[20], sym: 'MAN', side: 'BUY', qty: 30, price: px(20), fee: 0 }];
  const oA = rows(A.base, A.nav, {}, tr, () => hist, () => 1);
  const oB = rows(B.base, B.nav, flows, tr, () => hist, () => 1);
  // עם הפקדה המשקל של המניה הידנית קטן אחרי יום 60 → תוצאה שונה, אבל ביום ההפקדה עצמו אין קפיצה
  const jump = oB[60].value / oB[59].value - 1;
  const expect = (B.nav[59].total * (1 + rI(60)) + 30 * px(60) - 0) / (B.nav[59].total + 30 * px(59)) - 1;
  ok(near(jump, expect, 1e-12), 'יום ההפקדה: תשואה = ממוצע משוקלל, ההפקדה עצמה לא נספרת');
  ok(Math.abs(jump) < 0.05, 'אין קפיצה של 40% (20,000 על 50,000) ביום ההפקדה');
}

// --- 3. YTD: מניה קטנה (4%) שעשתה פחות מהתיק → YTD משולב מעט נמוך מ־IBKR ---
{
  const { nav, base } = build(null);
  const qty = 20; // ~4% מהתיק
  const out = rows(base, nav, {}, [{ id: 'x', date: days[5], sym: 'MAN', side: 'BUY', qty, price: px(5), fee: 0 }], () => hist.map((h, i) => ({ date: h.date, close: 100 * (1 + i * 0.0003) })), () => 1);
  const y0 = 40, yE = days.length - 1;
  const ib = base[yE].value / base[y0].value - 1;
  const comb = out[yE].value / out[y0].value - 1;
  const w = qty * 100 / nav[y0].total;
  ok(comb < ib && ib - comb < w * ib * 1.5 + 0.01, 'מניה קטנה וחלשה מהתיק: המשולב נמוך במעט (' + (ib * 100).toFixed(2) + '% → ' + (comb * 100).toFixed(2) + '%, משקל ' + (w * 100).toFixed(1) + '%)');
}

// --- 3ב. כותרת משולבת על אותה תקופה כמו הרשמית — גם כש־NAV יומי מתחיל מאוחר ---
// שוחזר מהשטח: NAV יומי מ־09/2023, תקופות רשמיות מ־01/2023. בלי ידניות הכותרת =
// רשמית (מ־01/2023); עם ידניות היא הפכה ל־last/first של הסדרה (מ־09/2023) = בדיוק
// "3 שנים" — ולא הייתה ברת השוואה ל"בלי".
{
  const head = vm.runInContext('combinedHeadlineTwr', sb);
  const base = [{ date: '2023-09-25', value: 100 }, { date: '2025-04-03', value: 120 }, { date: '2026-09-24', value: 148.32 }];
  const comb = [{ date: '2023-09-25', value: 100 }, { date: '2025-04-03', value: 120 }, { date: '2026-09-24', value: 154.31 }];
  const h = head(48.07, comb, base);
  ok(near(h, (1.4807 * (154.31 / 148.32) - 1) * 100, 1e-9), 'כותרת משולבת = רשמית × השפעת הידניות (' + h.toFixed(2) + '%, לא 54.31)');
  ok(near(head(48.07, base, base), 48.07, 1e-9), 'בלי השפעה ידנית → בדיוק הרשמי');
  ok(near(head(null, comb, base), 54.31, 1e-9), 'בלי רשמי — נפילה ל־last/first');
  // עקביות: NAV יומי חלקי + תיקון = אותה תוצאה כמו NAV יומי מלא
  const full = build(null);
  const tr = [{ id: 'x', date: days[70], sym: 'MAN', side: 'BUY', qty: 30, price: px(70), fee: 0 }];
  const official = (full.base[full.base.length - 1].value / full.base[0].value - 1) * 100;
  const combFull = rows(full.base, full.nav, {}, tr, () => hist, () => 1);
  const hFull = (combFull[combFull.length - 1].value / combFull[0].value - 1) * 100;
  const cut = 30; // NAV יומי רק מיום 30 — הסדרה "הרשמית" מתחילה שם ב־100
  const bPart = full.base.slice(cut).map((r) => ({ date: r.date, value: r.value / full.base[cut].value * 100 }));
  const combPart = rows(bPart, full.nav.slice(cut), {}, tr, () => hist, () => 1);
  ok(near(head(official, combPart, bPart), hFull, 1e-9), 'NAV יומי חלקי + תיקון = התוצאה עם NAV יומי מלא (' + hFull.toFixed(3) + '%)');
}

// --- 4. תווית המחיר בשורה אחת (₪/$ לא נשבר לשורות) ---
ok((src.match(/'<span>' \+ t\('(fldAvgPrice|fldTradePrice|fldFee)', \{ c: '<span class="cur-(sym|px)">/g) || []).length === 5, 'תוויות מחיר/עמלה עטופות — סימן המטבע באותה שורה');

const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');
console.log('\n' + n + ' בדיקות עברו');
