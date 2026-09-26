// ui-v166.test.js — סימן (+/−) תמיד משמאל למספר גם בעברית; בכרטיס המניה: היום % | שווי, מהקנייה % | רווח בכסף;
// תג טרום/אחרי־מסחר מתחת למחיר.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const sb = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }) }, window: {}, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(1), setTimeout, clearTimeout, console };
vm.createContext(sb); vm.runInContext(src, sb);
const A = (k) => vm.runInContext(k, sb);
const LRI = '⁦', PDI = '⁩';
ok(A('fmtPct')(0.52, true) === LRI + '+0.52%' + PDI, 'אחוז חיובי: "+0.52%" בבידוד LTR (הסימן משמאל, האחוז מימין)');
ok(A('fmtPct')(-0.03, true) === LRI + '−0.03%' + PDI, 'אחוז שלילי: סימן מינוס אמיתי (−), משמאל');
ok(A('fmtPct')(12.5, false) === LRI + '12.50%' + PDI && A('fmtPct')(null, true) === '—', 'בלי סימן / בלי ערך');
vm.runInContext('state.currency = "USD";', sb);
ok(A('fmtSignedMoney')(2215, 'USD') === LRI + '+$2,215' + PDI && A('fmtSignedMoney')(-14787, 'USD') === LRI + '−$14,787' + PDI, 'סכום עם סימן: "+$2,215" / "−$14,787"');
ok(A('fmtSignedMoney')(-1300, 'ILS') === LRI + '−₪1,300' + PDI && A('fmtSignedMoney')(null, 'USD') === '—', 'בשקלים; בלי ערך → מקף');
// כרטיס: 4 תאים — היום %, שווי, מהקנייה %, רווח בכסף
vm.runInContext('state.fx = 3.05; state.quotes = { ZZZ: { close: 150, date: "2026-09-25" } }; state.hist = {};', sb);
const p = { sym: 'ZZZ', name: 'Z', shares: 10, avg: 100 };
const m = A('metrics'); vm.runInContext('POSITIONS.push({ sym: "ZZZ", name: "Z", shares: 10, avg: 100 })', sb);
const mm = m('ZZZ');
const html = A('stockSubHTML')(p, mm);
ok(/class="day-chg/.test(html) && /class="sub-val"/.test(html) && /class="buy-chg pos"/.test(html) && /class="buy-amt pos"/.test(html), 'ארבעת התאים בסדר: היום, שווי, מהקנייה %, מהקנייה בכסף');
ok(html.includes('buyChg') || html.includes('+50.00%'), 'מהקנייה: +50.00% (150 מול ממוצע 100)');
ok(html.includes(LRI + '+$500' + PDI), 'מהקנייה בכסף: +$500 (10 מניות × $50)');
vm.runInContext('state.currency = "ILS";', sb);
ok(A('stockSubHTML')(p, m('ZZZ')).includes(LRI + '+₪1,525' + PDI), 'במטבע שקל: הרווח בשקלים');
ok(!/buy-chg/.test(A('stockSubHTML')({ sym: 'ZZZ', shares: 1, avg: 0 }, m('ZZZ'))), 'בלי מחיר קנייה — בלי שורת "מהקנייה"');
ok(/\.stock-sub \{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 1fr\) auto/.test(css), 'שורות המשנה: רשת של שתי עמודות (אחוזים / סכומים)');
ok(/<span class="sh-r2">[\s\S]*?<span class="stock-ext">' \+ extSessionHTML\(m\.q, m\)/.test(src), 'v204/v206: תג הסשן בשורה השנייה של הכרטיס (ליד שם החברה), מתעדכן בטיק');
ok(/for \(const cls of \['\.stock-sub', '\.stock-ext'\]\)/.test(src), 'טיק חי מעדכן גם את התג וגם את השורות');
ok(/ctx\.direction = 'ltr';/.test(src), 'ציר גרף הביצועים: "+18.7%" גם בקנבס');
ok(/\[\\u2067\\u0590-\\u05FF\]/.test(src), 'מחיר באגורות: בלי גלגול ספרות (רק הבזק) — הגלגול ערבב את הבידוד');
ok(/buyChg: 'מהקנייה \{v\}'/.test(src) && /buyChg: 'Since purchase \{v\}'/.test(src), 'מחרוזת בעברית ובאנגלית');
console.log('\n' + n + ' בדיקות עברו');
