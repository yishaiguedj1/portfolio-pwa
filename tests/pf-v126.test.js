// pf-v126.test.js — גרף ביצועי התיק: לחיצה רגילה = טולטיפ בלבד; מדידה רק
// אחרי כפתור "מדידה" (כמו בגרף המניה). בקשת המשתמש 24/09/2026.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

let n = 0;
function ok(cond, name) {
  n++;
  if (!cond) { console.error('FAIL - ' + name); process.exit(1); }
  console.log('ok - ' + name);
}

// קנבס מדומה עם מיפוי נקודות: 5 נקודות ב־x = 10, 60, 110, 160, 210
const canvas = {
  _pfMap: {
    n: 5, padL: 10, plotW: 200, xs: [10, 60, 110, 160, 210],
    series: [{ pts: ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01'].map((date, i) => ({ date, norm: 100 + i })) }],
  },
  getBoundingClientRect: () => ({ left: 0, top: 0 }),
};
const sb = {
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: {
    addEventListener() {},
    getElementById: (id) => (id === 'pfChart' ? canvas : null),
    querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }),
  },
  window: {}, navigator: {}, location: {},
  AbortController, fetch: () => Promise.reject(new Error('no net')),
  setTimeout, clearTimeout, console,
};
vm.createContext(sb);
vm.runInContext(src, sb);
// מחליפים ציור/טולטיפ בספירה — בודקים לוגיקה, לא DOM
vm.runInContext(`
  var __tips = [], __paints = 0;
  showPfTip = function (idx) { __tips.push(idx); };
  paintPfChart = function () { __paints++; };
`, sb);
const S = () => vm.runInContext('state', sb);
const tap = (x) => vm.runInContext('onPfTap', sb)({ clientX: x });

ok(S().pfMeasure.on === false, 'ברירת מחדל: מצב מדידה כבוי');

// לחיצה רגילה — טולטיפ בלבד, בלי נקודות מדידה
tap(62);
ok(S().pfMeasure.pts.length === 0, 'לחיצה בלי מדידה: לא נוצרת נקודת מדידה');
ok(S().pfTipIdx === 1, 'לחיצה בלי מדידה: הנקודה הקרובה נבחרה לטולטיפ');
tap(158);
ok(S().pfMeasure.pts.length === 0 && S().pfTipIdx === 3, 'לחיצה שנייה: עוברת לנקודה החדשה, עדיין בלי מדידה');
ok(vm.runInContext('__tips', sb).join(',') === '1,3', 'הטולטיפ הוצג בכל לחיצה');

// מצב מדידה — שתי נקודות, השלישית מתחילה מחדש
S().pfMeasure.on = true;
tap(12);
tap(208);
ok(S().pfMeasure.pts.join(',') === '0,4', 'מצב מדידה: שתי לחיצות = שתי נקודות');
tap(110);
ok(S().pfMeasure.pts.join(',') === '2', 'מצב מדידה: לחיצה שלישית מתחילה מדידה חדשה');

// הכפתור קיים בכלי הגרף, עם אותה מחרוזת כמו בגרף המניה
ok(/function renderPfTools[\s\S]*?t\('measure'\)[\s\S]*?pfMeasure\.on = !state\.pfMeasure\.on/.test(src), 'כפתור "מדידה" בכלי גרף הביצועים מחליף מצב');
ok(/el\('button', 'chip-btn' \+ \(state\.pfMeasure\.on \? ' on' : ''\), t\('measure'\)\)/.test(src), 'אותו רכיב chip-btn כמו בגרף המניה, מודגש כשפעיל');

// גרסאות
const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
ok(sw.includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');

console.log('\n' + n + ' בדיקות עברו');
