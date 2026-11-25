// stock-px-test.test.js — מחיר לבדיקה בכרטיס המניה (25/11/2026, בקשת המשתמש): כמו בניתוח — המחיר שנבחר ביד משנה
// את השווי, הרווח, המשקל, המרחק מהשיא והסקירה (שווי, עוגה, רווח ב־IBKR), מסומן בכתום, ו"החזר" מחזיר הכל.
// בזיכרון בלבד. וגם: תגית "ידני" מתחת ללוגו של IBKR. נתונים סינתטיים בלבד.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const retSrc = fs.readFileSync(path.join(root, 'returns.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const gb = fs.readFileSync(path.join(root, 'glass-btn.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-9);

const sb = {
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { hidden: false, activeElement: null, addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, style: {} }) },
  window: {}, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(new Error('no net')),
  setTimeout, clearTimeout, console: { log() {}, warn() {}, error: console.error },
};
vm.createContext(sb);
vm.runInContext(retSrc, sb);
vm.runInContext(src, sb);
const A = (k) => vm.runInContext(k, sb);
const run = (c) => vm.runInContext(c, sb);

run(`POSITIONS.length = 0;
  POSITIONS.push({ sym: 'AAA', name: 'A', shares: 10, avg: 100 }, { sym: 'BBB', name: 'B', shares: 20, avg: 50, src: 'manual' });
  state.quotes = { AAA: { close: 150 }, BBB: { close: 50 } }; state.hist = {}; state.fx = 4; state.currency = 'USD'; DB.cash = { usd: 500, ils: 0 };`);

// --- 1. בלי מחיר לבדיקה — הכל כמו קודם ---
let m = A('metrics')('AAA');
ok(m.price === 150 && m.price0 === 150 && m.ovr === false, 'בלי שינוי: המחיר האמיתי, ovr=false');
ok(A('quotesOvr')() === A('state').quotes, 'בלי שינוי: quotesOvr מחזיר את state.quotes עצמו');
ok(A('weightTxt')('AAA') === (1500 / 3000 * 100).toFixed(1) + '%', 'משקל רגיל');

// --- 2. מחיר לבדיקה ---
A('setPxOvr')('AAA', 250);
m = A('metrics')('AAA');
ok(m.price === 250 && m.price0 === 150 && m.ovr === true, 'המחיר לבדיקה בכרטיס, והאמיתי נשמר ב־price0');
ok(near(m.value, 2500) && near(m.gl, 1500), 'השווי והרווח לפי המחיר החדש');
ok(A('state').quotes.AAA.close === 150, 'state.quotes לא משתנה');
ok(near(A('totalsUSD')().stockVal, 2500 + 1000), 'שווי התיק לפי המחיר החדש');
ok(A('weightTxt')('AAA') === (2500 / 4000 * 100).toFixed(1) + '%' && A('weightTxt')('BBB') === (1000 / 4000 * 100).toFixed(1) + '%', 'המשקל של כל המניות זז');
ok(A('metrics')('AAA', true).price === 150 && A('metrics')('AAA', true).ovr === false, 'real (חיפוש/ווידג׳ט) — תמיד המחיר האמיתי');
ok(near(A('pxOvrIbkrDeltaUSD')(), 1000), 'הפרש השווי בחלק של IBKR — לרווח שבסקירה');
A('setPxOvr')('BBB', 60);
ok(near(A('pxOvrIbkrDeltaUSD')(), 1000), 'מניה ידנית לא נספרת בהפרש של IBKR (manualTotalsUSD כבר מחושב מ־quotesOvr)');
ok(near(A('manualTotalsUSD')(A('POSITIONS'), [], A('quotesOvr')(), 4).value, 1200), 'שווי ידני לפי המחיר לבדיקה');
A('setPxOvr')('BBB', null);

// --- 3. השיא לא מתעדכן ממחיר מדומה ---
run(`state.hist.AAA = [{ date: '2026-01-02', close: 200 }, { date: '2026-01-03', close: 150 }];`);
m = A('metrics')('AAA');
ok(m.ath && m.ath.price === 200 && near(m.offAth, 25), 'השיא נשאר מההיסטוריה; המרחק ממנו לפי המחיר לבדיקה');
run(`state.hist = {};`);

// --- 4. הסימון ---
const head = A('stockHeadHTML')(A('POSITIONS')[0], A('metrics')('AAA'));
ok(/stock-price[^"]*px-ovr/.test(head), 'המחיר בכתום (px-ovr)');
ok(/day-chg px-was/.test(head) && head.includes('$150.00'), '"במקום $150.00" במקום השינוי היומי');
ok(/<span class="px-pen on" role="button"[^>]*>.*?<\/svg><\/span><span class="stock-price/.test(head), 'העיפרון צמוד למחיר מימין (לפניו ב־DOM), כתום כשהמחיר שונה');
ok(/closest\('\.px-pen'\)\) \{ e\.stopPropagation\(\); openPxSheet\(sym\)/.test(src), 'לחיצה על העיפרון פותחת את הגיליון ולא פותחת/סוגרת את הכרטיס');
ok(/\.sh-r1 \.px-pen::after \{[^}]*inset: -8px/.test(css), 'אזור לחיצה מוגדל סביב העיפרון');
ok((head.match(/px-dep/g) || []).length >= 3, 'נקודה כתומה ליד השווי והרווח בשורת המשנה');
const kv = A('kvGridHTML')(A('POSITIONS')[0], A('metrics')('AAA'));
ok((kv.match(/px-dep/g) || []).length >= 4, 'נקודה כתומה באריחי השווי, הרווח והמשקל');
const kvB = A('kvGridHTML')(A('POSITIONS')[1], A('metrics')('BBB'));
ok((kvB.match(/px-dep/g) || []).length === 1, 'מניה אחרת: רק המשקל מסומן (הוא זז)');

// --- 5. החזרה ---
A('setPxOvr')('AAA', null);
ok(A('metrics')('AAA').ovr === false && A('pxOvrSyms')().length === 0 && !/px-dep|px-ovr/.test(A('stockHeadHTML')(A('POSITIONS')[0], A('metrics')('AAA'))), '"החזר": בלי סימון ובלי שינוי');
A('setPxOvr')('ZZZ', 10);
ok(A('pxOvrSyms')().length === 0, 'מניה שלא בתיק / בלי מחיר — לא נספרת');
A('setPxOvr')('ZZZ', null);

// --- 6. בזיכרון בלבד ---
ok(!/PX_OVR[^\n]*(localStorage|saveDB|DB\.)/.test(src) && !/ACCOUNT_KEYS[^\n]*pxOvr/.test(src), 'המחיר לבדיקה לא נשמר (לא localStorage ולא DB)');

// --- 7. תגית "ידני" מתחת ללוגו של IBKR ---
run(`POSITIONS.push({ sym: 'CCC', name: 'C', shares: 125, avg: 90, src: 'ibkr', mtSh: 15, ib: { shares: 110 } }); state.quotes.CCC = { close: 91 };`);
const hc = A('stockHeadHTML')(A('POSITIONS')[2], A('metrics')('CCC'));
ok(/<span class="src-stack"><span class="src-tag[^>]*>.*<\/span><span class="src-tag">ידני<\/span><\/span>(<span class="px-pen.*?<\/svg><\/span>)?<span class="stock-price/.test(hc), 'משני מקורות: המקור הראשי ומתחתיו "ידני" בעמודה אחת, לפני המחיר');
ok(!/src-stack/.test(A('stockHeadHTML')(A('POSITIONS')[0], A('metrics')('AAA'))), 'מקור אחד — בלי עמודה');
ok(/\.sh-r1 \.src-stack \{[^}]*flex-direction: column/.test(css), 'העמודה ב־CSS');

// --- 8. עיצוב וכפתורים ---
ok(/--px-ed-fill/.test(css) && /\[data-theme="dark"\] \{ --px-ed/.test(css), 'צבעי הכתום — בהיר וכהה');
ok(/\.px-edrow-b/.test(gb) && /\.px-pen\.on/.test(gb) && /\.an-pxed, \.px-pen,/.test(gb), 'הכפתורים מסווגים בכפתורי הזכוכית (כתום)');
ok(/id="ovPxRow"/.test(html), 'מקום לשורה "מה שונה" בראש הסקירה');
for (const k of ['stPxEx', 'stPxRowT', 'stPxRowS', 'stPxRowN', 'stPxRowNS']) ok(A('STRINGS').he[k] && A('STRINGS').en[k], 'מחרוזת ' + k + ' בעברית ובאנגלית');

console.log('\n' + n + ' בדיקות עברו');
