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
// v205: מחיר גדול בכרטיס, מוקטן רק כשהוא ארוך במיוחד
ok(R("stockPriceSizeCls('$16.70')") === '' && R("stockPriceSizeCls('$1,234.56')") === ' px-lg' && R("stockPriceSizeCls('$12,345.67')") === ' px-xl', 'גודל מחיר לפי אורך (v205)');
ok(/\.sh-r1 \.stock-price \{[^}]*font-size: 27px/.test(css), 'מחיר 27px בכרטיס (v205)');
// v206: בורסת ת״א — ב'–ו', חגים לפי הלוח העברי (Intl), בלי מסחר מאוחר
const TA = (iso) => JSON.stringify(R('taseMarketNow(Date.parse("' + iso + '"))'));
for (const [iso, exp, name] of [
  ['2026-09-11T09:00:00Z', '{"closed":true,"reason":"hdTaErevRH"}', 'ערב ראש השנה (ו׳ 11/9)'],
  ['2026-09-21T09:00:00Z', '{"closed":true,"reason":"hdTaYK"}', 'יום כיפור (ב׳ 21/9)'],
  ['2026-09-25T09:00:00Z', '{"closed":true,"reason":"hdTaErevSukkot"}', 'ערב סוכות (ו׳ 25/9 — אין מסחר, אומת מול Yahoo)'],
  ['2026-09-26T09:00:00Z', '{"closed":true,"reason":"hdTaSukkot"}', 'סוכות בשבת — החג קודם לסופ״ש'],
  ['2026-09-27T09:00:00Z', '{"closed":true,"reason":"hdWeekend"}', 'ראשון = סופ״ש (מסחר ב׳–ו׳ מ־2026)'],
  ['2026-09-28T09:00:00Z', '{"closed":false,"reason":null}', 'ב׳ 12:00 — פתוח'],
  ['2026-09-28T16:00:00Z', '{"closed":true,"reason":null}', 'ב׳ 19:00 — סגור בלי סיבה'],
  ['2026-10-02T09:00:00Z', '{"closed":true,"reason":"hdTaErevSimchat"}', 'הושענא רבה'],
  ['2026-10-09T10:30:00Z', '{"closed":false,"reason":null}', 'ו׳ 13:30 — פתוח'],
  ['2026-10-09T11:30:00Z', '{"closed":true,"reason":null}', 'ו׳ 14:30 — סגור'],
  ['2026-03-03T09:00:00Z', '{"closed":true,"reason":"hdTaPurim"}', 'פורים'],
  ['2026-04-02T09:00:00Z', '{"closed":true,"reason":"hdTaPesach"}', 'פסח'],
  ['2026-04-08T09:00:00Z', '{"closed":true,"reason":"hdTaPesach"}', 'שביעי של פסח'],
  ['2026-04-22T09:00:00Z', '{"closed":true,"reason":"hdTaIndependence"}', 'יום העצמאות'],
  ['2026-05-22T09:00:00Z', '{"closed":true,"reason":"hdTaShavuot"}', 'שבועות'],
  ['2026-07-23T09:00:00Z', '{"closed":true,"reason":"hdTaTishaBav"}', 'ט׳ באב'],
]) ok(TA(iso) === exp, 'ת״א: ' + name);
ok(R("taseHolidayKey({ hm: 'Iyar', hd: 4, dow: 4 })") === 'hdTaIndependence' && R("taseHolidayKey({ hm: 'Iyar', hd: 5, dow: 5 })") === null, 'יום העצמאות מוקדם לחמישי כשה׳ באייר בשישי');
ok(R("taseHolidayKey({ hm: 'Iyar', hd: 6, dow: 2 })") === 'hdTaIndependence' && R("taseHolidayKey({ hm: 'Iyar', hd: 5, dow: 1 })") === null, 'יום העצמאות נדחה לשלישי כשה׳ באייר בשני');
R("taseMarketNow = () => ({ closed: true, reason: 'hdTaSukkot' })");
const taH = R("extSessionHTML(null, { p: { sym: 'POLI.TA' }, dayChg: -0.7 })");
ok(/השוק סגור ·<\/span><span class="ext-lbl">סוכות/.test(taH) && /סגירה<\/span>/.test(taH) && /ext-dot off/.test(taH) && /ext-sess closed neg/.test(taH), 'בועת ת״א: "השוק סגור · סוכות" + "סגירה" ושינוי יום המסחר האחרון');
R("taseMarketNow = () => ({ closed: false, reason: null })");
ok(R("extSessionHTML(null, { p: { sym: 'POLI.TA' }, dayChg: 1 })") === '', 'ת״א בזמן מסחר: בלי בועה (כמו מסחר רגיל בארה״ב)');
// v207: נקודת שער הדולר — מט״ח 24/5 (ראשון 17:00 עד שישי 17:00 ניו־יורק)
ok(R('fxMarketOpen(Date.parse("2026-09-26T15:00:00Z"))') === false, 'מט״ח: שבת — סגור');
ok(R('fxMarketOpen(Date.parse("2026-09-27T20:00:00Z"))') === false && R('fxMarketOpen(Date.parse("2026-09-27T22:00:00Z"))') === true, 'מט״ח: ראשון — נפתח ב־17:00 ניו־יורק');
ok(R('fxMarketOpen(Date.parse("2026-09-25T20:30:00Z"))') === true && R('fxMarketOpen(Date.parse("2026-09-25T21:30:00Z"))') === false, 'מט״ח: שישי — נסגר ב־17:00 ניו־יורק');
ok(/id="fxDot"/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')) && /\.fx-pill \{[^}]*background: var\(--surface-2\)/.test(css), 'בועת שער הדולר: נקודה + עיצוב בועת הסשן (v207)');
const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');
console.log('\n' + n + ' בדיקות עברו');
