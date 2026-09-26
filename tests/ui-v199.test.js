// ui-v199.test.js — "השוק סגור · סיבה" בתווית הסשן: לוח חגי NYSE לפי כללים (בלי רשת), סופ״ש לפי ניו־יורק,
// השינוי של המסחר המאוחר האחרון נשאר, והבועה נשברת יפה כשהטקסט ארוך.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const sb = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, style: {} }) }, window: {}, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(new Error('x')), setTimeout, clearTimeout, console, Image: class { set src(_) {} } };
vm.createContext(sb); vm.runInContext(src, sb);
const R = (c) => vm.runInContext(c, sb);

// לוח NYSE 2026 (nyse.com) — כולל שישי הטוב, ג׳ונטינת׳ ו־4/7 שנופל בשבת ונצפה ב־3/7
const h26 = R('nyseHolidays(2026)');
for (const [d, k] of [['2026-01-01', 'hdNewYear'], ['2026-01-19', 'hdMlk'], ['2026-02-16', 'hdPresidents'], ['2026-04-03', 'hdGoodFriday'], ['2026-05-25', 'hdMemorial'], ['2026-06-19', 'hdJuneteenth'], ['2026-07-03', 'hdIndependence'], ['2026-09-07', 'hdLabor'], ['2026-11-26', 'hdThanksgiving'], ['2026-12-25', 'hdChristmas']])
  ok(h26[d] === k, '2026: ' + d + ' = ' + k);
ok(Object.keys(h26).length === 10, '2026: בדיוק 10 חגים');
const h27 = R('nyseHolidays(2027)');
ok(h27['2027-03-26'] === 'hdGoodFriday' && h27['2027-06-18'] === 'hdJuneteenth' && h27['2027-07-05'] === 'hdIndependence' && h27['2027-12-24'] === 'hdChristmas', '2027: פסחא, ג׳ונטינת׳ בשבת→שישי, 4/7 בראשון→שני, המולד בשבת→שישי');
const h22 = R('nyseHolidays(2022)');
ok(!h22['2021-12-31'] && !h22['2022-01-01'] && h22['2022-06-20'] === 'hdJuneteenth' && h22['2022-04-15'] === 'hdGoodFriday', '2022: 1/1 בשבת לא נצפה בשישי (כלל NYSE); ג׳ונטינת׳ בראשון→שני');
const h25 = R('nyseHolidays(2025)');
ok(h25['2025-04-18'] === 'hdGoodFriday' && h25['2025-11-27'] === 'hdThanksgiving' && h25['2025-01-09'] === undefined, '2025: שישי הטוב 18/4, ההודיה 27/11; יום אבל לאומי (9/1) לא בלוח — מוצג "סגור" בלי סיבה');

// סיבת הסגירה לפי ניו־יורק
ok(R('marketClosedReason(Date.UTC(2026, 8, 26, 12))') === 'hdWeekend', 'שבת 26/09/2026 = סופ״ש');
ok(R('marketClosedReason(Date.UTC(2026, 8, 27, 23))') === 'hdWeekend', 'ראשון בערב (ניו־יורק) = סופ״ש');
ok(R('marketClosedReason(Date.UTC(2026, 8, 28, 2))') === 'hdWeekend', 'שני 02:00 UTC = עדיין ראשון בניו־יורק → סופ״ש');
ok(R('marketClosedReason(Date.UTC(2026, 10, 26, 15))') === 'hdThanksgiving', 'חג ההודיה 2026');
ok(R('marketClosedReason(Date.UTC(2026, 8, 28, 15))') === null, 'יום מסחר רגיל = null');

// התווית
R("state.lang = 'he'");
const closedHtml = R("extSessionHTML({ session: 'closed', ext: { kind: 'post', price: 100, pct: -0.46 } })");
ok(/ext-sess closed neg/.test(closedHtml) && /השוק סגור/.test(closedHtml) && /0\.46%/.test(closedHtml), 'סגור: "השוק סגור" + השינוי של המסחר המאוחר האחרון, בצבע לפי הכיוון');
ok(/class="ext-dot off"/.test(closedHtml), 'סגור: נקודה אפורה קבועה (v200) — מהבהבת רק במסחר פעיל');
ok(/\.ext-dot\.off \{ animation: none;/.test(css) && /\[data-theme="dark"\] \.ext-dot\.off/.test(css), 'CSS: הנקודה הכבויה לא מהבהבת, עם גוון נפרד למצב כהה');
ok((closedHtml.match(/class="ext-line"/g) || []).length === 2 && /אחרי־מסחר/.test(closedHtml) && /class="ext-pct"/.test(closedHtml), 'סגור (v201): שתי שורות — סיבה, ומתחת הסשן האחרון + האחוז');
const preHtml = R("extSessionHTML({ session: 'pre', ext: { kind: 'pre', price: 100, pct: 1.2 } })");
ok(/ext-dot/.test(preHtml) && /טרום־מסחר/.test(preHtml) && !/השוק סגור/.test(preHtml), 'טרום־מסחר: כמו קודם');
const nightHtml = R("extSessionHTML({ session: 'night', ext: { kind: 'night', price: 100, pct: 0.3 } })");
ok(/לילי/.test(nightHtml), 'לילי: כמו קודם');
for (const k of ['sessClosed', 'hdWeekend', 'hdNewYear', 'hdMlk', 'hdPresidents', 'hdGoodFriday', 'hdMemorial', 'hdJuneteenth', 'hdIndependence', 'hdLabor', 'hdThanksgiving', 'hdChristmas'])
  ok(R("STRINGS.he['" + k + "'] && STRINGS.en['" + k + "']"), 'מחרוזת ' + k + ' בעברית ובאנגלית');
ok(/\.ext-sess \{[^}]*flex-wrap: wrap/.test(css) && /\.ext-sess \{[^}]*max-width: 100%/.test(css), 'CSS: הבועה נשברת לשורה שנייה במקום לגלוש');
ok(/\.ext-sess \.ext-lbl \{ white-space: nowrap; \}/.test(css) && /\.ext-sess \.ext-pct \{ white-space: nowrap; \}/.test(css), 'CSS: השבירה רק בין התווית לאחוז');
// v202: קיצורים — הבועה בשתי שורות ליד המחיר בלי לעלות על שם החברה/תגית המקור
for (const [k, v] of [['hdNewYear', 'ראש השנה'], ['hdMlk', 'יום MLK'], ['hdPresidents', 'הנשיאים'], ['hdGoodFriday', 'שישי הטוב'], ['hdIndependence', '4 ביולי'], ['hdLabor', 'העבודה']])
  ok(R("STRINGS.he['" + k + "']") === v, 'קיצור (v202): ' + k + ' = ' + v);
R("marketClosedReason = () => 'hdThanksgiving'");
const heT = R("extSessionHTML({ session: 'closed', ext: { kind: 'post', price: 1, pct: -2.34 } })");
ok(/השוק סגור ·<\/span><span class="ext-lbl">חג ההודיה/.test(heT), 'עברית: "השוק סגור ·" והסיבה ב־spans נפרדים');
R("state.lang = 'en'");
const enT = R("extSessionHTML({ session: 'closed', ext: { kind: 'post', price: 1, pct: -2.34 } })");
ok(/Closed ·<\/span><span class="ext-lbl">Thanksgiving</.test(enT) && !/השוק/.test(enT) && /Post</.test(enT), 'אנגלית (v203): "Closed ·" + הסיבה + Post, בלי נפילה לעברית');
ok(/\.sh-r1 \.src-tag \{[^}]*font-size: 10\.5px/.test(css), 'תגית המקור בכרטיס 10.5px, מעט למעלה (v204)');
R("marketClosedReason = () => null");
ok(/>Closed</.test(R("extSessionHTML({ session: 'closed', ext: { kind: 'post', price: 1, pct: 0 } })")), 'אנגלית בלי סיבה: "Closed"');
R("state.lang = 'he'");
ok(/class="sh-r1"><span class="stock-sym">[\s\S]*stock-price/.test(src) && /class="sh-r2"><span class="stock-name">[\s\S]*stock-ext/.test(src), 'v204: שורה 1 סימבול+תגית+מחיר, שורה 2 שם+בועה');
ok(/\.stock-id \.stock-name \{ contain: inline-size; justify-self: stretch; \}/.test(css), 'שם ארוך נקטע ב־… באותו מקום ולא דוחף את הבועה');
const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');
console.log('\n' + n + ' בדיקות עברו');
