// pf-v147.test.js — תגית מקור אחידה: "ידני" או לוגו IBKR על כל פריט (מניות, עסקאות,
// הפקדות/משיכות, פנסיה) ועל כפתורי האיפוס — מסונכרן עם הגדרת המאגרים של v146.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

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
const tag = A('srcTagHTML');

// --- 1. התגית ---
ok(/src-ibkr/.test(tag('ibkr')) && /ibkr-logo\.png/.test(tag('ibkr')) && /Interactive Brokers/.test(tag('ibkr')), 'IBKR: לוגו Interactive Brokers');
ok(/class="src-tag"/.test(tag('manual')) && />ידני</.test(tag('manual')) && !/img/.test(tag('manual')), 'ידני: התגית "ידני"');
ok(fs.existsSync(path.join(root, 'ibkr-logo.png')) && fs.statSync(path.join(root, 'ibkr-logo.png')).size < 8000, 'קובץ הלוגו קיים וקטן');
ok(/'\.\/ibkr-logo\.png'/.test(sw), 'הלוגו במטמון ה־Service Worker (עובד אופליין)');

// --- 2. מקור לפי אותה הגדרה כמו האיפוס ---
vm.runInContext("DB.source = 'ibkr'", sb);
ok(A('positionSource')({ sym: 'A' }) === 'ibkr' && A('positionSource')({ sym: 'B', src: 'manual' }) === 'manual', 'מצב IBKR: מניה מהדוח = IBKR, ידנית = ידני');
vm.runInContext("DB.source = 'manual'", sb);
ok(A('positionSource')({ sym: 'A' }) === 'manual', 'מצב ידני: כל מניה = ידני');
// התגית בכל שורה נגזרת מאותן פונקציות שקובעות מה כל כפתור איפוס מוחק
const m = { source: 'ibkr', positions: [{ sym: 'I' }, { sym: 'M', src: 'manual' }], deposits: [{ date: '2024-01-02', amount: -1 }, { date: '01/02/2024', amount: -1 }],
  manualTrades: [], pensionFunds: [], pensionDeposits: [], cash: { usd: 0, ils: 0 } };
vm.runInContext("DB.source = 'ibkr'", sb);
const tagged = { pos: m.positions.map((p) => A('positionSource')(p)), dep: m.deposits.map((d) => (A('isIbkrDeposit')(d) ? 'ibkr' : 'manual')) };
A('resetIbkrData')(m, true);
ok(m.positions.every((p) => tagged.pos[['I', 'M'].indexOf(p.sym)] === 'manual') && m.deposits.every((d) => !A('isIbkrDeposit')(d)),
  'סנכרון: "איפוס IBKR" מוחק בדיוק את מה שמסומן בלוגו IBKR');
ok(tagged.dep.join(',') === 'ibkr,manual', 'הפקדה ISO = IBKR, DD/MM/YYYY = ידני');

// --- 3. חיווט: כל סוגי השורות ---
ok(/srcTagHTML\(positionSource\(p\)\)/.test(src), 'כרטיס מניה: תגית לפי המקור');
ok(/buildTradeRow\(r\.ib, 'ibkr'\)/.test(src) && /currency: symCur\(n\.sym\) \}, 'manual'\)/.test(src), 'עסקאות: IBKR עם לוגו, ידניות עם "ידני"');
ok(/srcTagHTML\(isIbkrDeposit\(d\) \? 'ibkr' : 'manual'\)/.test(src), 'הפקדות ומשיכות: תגית לפי המקור');
ok((src.match(/srcTagHTML\('manual'\) \+ '<br>/g) || []).length >= 3, 'קניות ידניות בטאב ההפקדות ושורות פנסיה: "ידני"');
ok(/fmtDateIL\(d\.date\) : String\(d\.date/.test(src), 'הפקדת IBKR מוצגת DD/MM/YYYY כמו השאר (לא 2023-09-28)');
ok(!/'<span class="src-tag">' \+ esc\(t\('manualTag'\)\) \+ '<\/span>' : ''/.test(src), 'אין עוד תגית "ידני" בלבד בלי חלופת IBKR');

// --- 4. כפתורי האיפוס ---
ok(/id="resetManual"[^>]*><span class="src-tag" data-i18n="manualTag">/.test(html), 'כפתור איפוס ידני: תגית "ידני"');
ok(/id="resetIbkr"[^>]*><span class="src-tag src-ibkr"[^>]*><img src="ibkr-logo\.png"/.test(html), 'כפתור איפוס IBKR: לוגו IBKR');
ok(/\.src-tag\.src-ibkr\s*\{/.test(css) && /\.danger-btn \.src-tag\s*\{/.test(css), 'CSS: תגית IBKR ותגית על כפתור אדום');

const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(sw.includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');
console.log('\n' + n + ' בדיקות עברו');
