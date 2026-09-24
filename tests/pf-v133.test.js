// pf-v133.test.js — תרשים עוגה: גודל, צבעי מותג + פלטת גיבוי, סידור
// שכנים־מובדלים, לוגואים בתוך המשולשים ובליד המקרא. בקשת המשתמש 24/09/2026.
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

/* קנבס מדומה: מספיק כדי ש-drawPie ירוץ מקצה לקצה בלי DOM אמיתי,
   ותופס אילו צבעים/לוגואים נצוירו (calls) לבדיקה. */
function fakeCanvas() {
  const calls = [];
  const backing = {};
  const ctx = new Proxy({}, {
    get(_, k) {
      if (k === 'fillStyle' || k === 'font' || k === 'textAlign' || k === 'textBaseline' ||
        k === 'shadowColor' || k === 'shadowBlur' || k === 'lineWidth') return backing[k];
      return (...args) => { calls.push([String(k), args]); };
    },
    set(_, k, v) { backing[k] = v; if (k === 'fillStyle') calls.push(['fillStyle', [v]]); return true; },
  });
  return {
    calls,
    clientWidth: 400, clientHeight: 400,
    getContext: () => ctx,
  };
}

function makeSandbox() {
  const store = {};
  const legendChildren = [];
  const legendEl = {
    innerHTML: '', children: legendChildren,
    appendChild(c) { legendChildren.push(c); },
  };
  const canvas = fakeCanvas();
  const sb = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    document: {
      addEventListener() {},
      getElementById: (id) => (id === 'pieChart' ? canvas : id === 'pieLegend' ? legendEl : null),
      querySelectorAll: () => [], querySelector: () => null,
      createElement: () => ({ innerHTML: '', classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, style: {} }),
    },
    window: { devicePixelRatio: 1 }, navigator: {}, location: {},
    AbortController, fetch: () => Promise.reject(new Error('no net')),
    setTimeout, clearTimeout, console, Image: class { set src(_) {} },
  };
  vm.createContext(sb);
  vm.runInContext(src, sb);
  return { sb, canvas, legendChildren };
}

(async () => {
  const { sb, canvas, legendChildren } = makeSandbox();
  const A = (k) => vm.runInContext(k, sb);
  const run = (code) => vm.runInContext(code, sb);

  // --- 1. צבע מותג ידוע (מפוסטל) לעומת פלטת גיבוי ---
  const pastelize = A('pastelizeBrand');
  ok(A('pieColorFor')('META', 5).toUpperCase() === pastelize(A('PIE_BRAND_COLORS').META).toUpperCase(),
    'META: גוון פסטלי של צבע המותג הידוע, לא הפלטה');
  ok(A('pieColorFor')('meta', 5) === A('pieColorFor')('META', 5), 'סימבול תלוי-רישיות: אותו צבע');
  ok(A('pieColorFor')('XYZ', 0) === A('PIE_FALLBACK_PALETTE')[0], 'סימבול לא ממותג: הצבע הראשון בפלטת הגיבוי');
  ok(A('pieColorFor')('XYZ', 1) === A('PIE_FALLBACK_PALETTE')[1], 'סימבול לא ממותג הבא: הצבע הבא בפלטה');
  const plen = A('PIE_FALLBACK_PALETTE').length;
  ok(A('pieColorFor')('XYZ', plen) === A('PIE_FALLBACK_PALETTE')[0], 'הפלטה מסתובבת (מודולו)');
  // הצבע הפסטלי עדיין באותו גוון (h) כמו צבע המותג המקורי — מזוהה כמו קודם, רק רך יותר
  const hsl = A('pieHexToHsl');
  const metaBrand = hsl(A('PIE_BRAND_COLORS').META), metaPastel = hsl(A('pieColorFor')('META', 0));
  ok(Math.abs(metaBrand.h - metaPastel.h) < 1, 'META: הגוון הפסטלי שומר על ה-hue של צבע המותג');
  ok(metaPastel.l > metaBrand.l, 'META: הפסטל בהיר יותר מצבע המותג הרווי');

  // --- 2. מרחק צבעים ---
  const dist = A('pieColorDistance');
  ok(dist('#FF0000', '#FF0000') < 1e-9, 'אותו צבע: מרחק 0');
  ok(dist('#FF0000', '#00FF00') > dist('#FF0000', '#FF3300'), 'אדום-ירוק רחוקים יותר מאדום-אדום-כתמתם');
  ok(dist('#000000', '#FFFFFF') > 0.25, 'שחור-לבן: מרחק גדול (הפרש בהירות)');

  // --- 3. סידור שכנים־מובדלים ---
  const arrange = A('pieArrangeSlices');
  const wrapDistOk = (arr) => {
    for (let i = 0; i < arr.length; i++) {
      const d = dist(arr[i].color, arr[(i + 1) % arr.length].color);
      if (d < 0.1) return false;
    }
    return true;
  };
  const tricky = [
    { sym: 'A', color: '#FF0000' }, { sym: 'B', color: '#FF1500' }, // כמעט זהים לאדום
    { sym: 'C', color: '#00FF00' }, { sym: 'D', color: '#0000FF' },
    { sym: 'E', color: '#FFFF00' },
  ];
  const out = arrange(tricky);
  ok(out.length === tricky.length, 'סידור: אותו מספר חתיכות');
  ok(out.map((s) => s.sym).sort().join(',') === 'A,B,C,D,E', 'סידור: אותן חתיכות (רק סדר שונה)');
  ok(wrapDistOk(out), 'סידור: אין שתי שכנות (כולל התפר המעגלי) בצבע כמעט זהה');
  ok(arrange([]).length === 0, 'סידור: מערך ריק לא קורס');
  ok(arrange([tricky[0]]).length === 1, 'סידור: חתיכה אחת לא קורסת');
  const two = arrange([tricky[0], tricky[1]]);
  ok(two.length === 2, 'סידור: שתי חתיכות מוחזרות כמו שהן (אין מה לסדר)');

  // --- 3ב. פיזור צבעים גלובלי (לא רק שכנות) — כמה "כחולים" רשמיים לא יתכנסו לאותו גוון ---
  const dedupe = A('pieDedupeColors');
  const manyBlues = ['#0866FF', '#236CFF', '#1A1F71', '#263D96', '#3AA76D'].map((c, i) => ({ sym: 'S' + i, color: c }));
  const deduped = dedupe(manyBlues);
  ok(deduped.length === manyBlues.length, 'פיזור: אותו מספר חתיכות');
  let worstPair = Infinity;
  for (let i = 0; i < deduped.length; i++) {
    for (let j = i + 1; j < deduped.length; j++) worstPair = Math.min(worstPair, dist(deduped[i].color, deduped[j].color));
  }
  const worstBefore = (() => {
    let w = Infinity;
    for (let i = 0; i < manyBlues.length; i++) for (let j = i + 1; j < manyBlues.length; j++) w = Math.min(w, dist(manyBlues[i].color, manyBlues[j].color));
    return w;
  })();
  ok(worstPair > worstBefore, 'פיזור: הזוג הכי קרוב מתרחק אחרי הפיזור');
  ok(dedupe([]).length === 0, 'פיזור: מערך ריק לא קורס');
  ok(dedupe([manyBlues[0]]).length === 1, 'פיזור: חתיכה אחת לא קורסת (אין למה להשוות)');
  const farColors = [{ sym: 'X', color: '#FF0000' }, { sym: 'Y', color: '#00FF00' }];
  ok(dedupe(farColors).map((s) => s.color).join(',') === farColors.map((s) => s.color).join(','), 'פיזור: צבעים כבר מרוחקים לא זזים');

  // --- 4. drawPie: גודל מרובע, לוגו במקרא, ללא קריסה ---
  run(`
    POSITIONS.length = 0;
    POSITIONS.push({ sym: 'META', name: 'Meta', shares: 10, avg: 100 });
    POSITIONS.push({ sym: 'ADBE', name: 'Adobe', shares: 5, avg: 200 });
    state.quotes = { META: { close: 300 }, ADBE: { close: 400 } };
    DB.cash = { usd: 0, ils: 0 };
    drawPie();
  `);
  const fills = canvas.calls.filter((c) => c[0] === 'fillStyle').map((c) => c[1][0].toUpperCase());
  ok(fills.includes(A('pieColorFor')('META', 0).toUpperCase()), 'drawPie: META צוירה בגוון הפסטלי של צבע המותג שלה');
  ok(fills.includes(A('pieColorFor')('ADBE', 0).toUpperCase()), 'drawPie: ADBE צוירה בגוון הפסטלי של צבע המותג שלה');
  ok(legendChildren.length === 2, 'drawPie: שורת מקרא לכל חברה');
  ok(legendChildren.every((li) => /pie-leg-logo/.test(li.innerHTML)), 'מקרא: לוגו קטן בכל שורה');
  ok(legendChildren.every((li) => /class="dot"/.test(li.innerHTML)), 'מקרא: עיגול הצבע עדיין קיים');
  ok(/pie-leg-logo[\s\S]*?dot/.test(legendChildren[0].innerHTML), 'מקרא: הלוגו לפני עיגול הצבע (ימני יותר ב-RTL)');
  ok(legendChildren.every((li) => /financialmodelingprep\.com\/image-stock\//.test(li.innerHTML)), 'מקרא: מקור הלוגו כמו בטאב המניות');

  // --- 5. CSS: קנבס מרובע וגדול, כרטיס לוגו למקרא ---
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  ok(/#pieChart\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/.test(css), 'CSS: הקנבס מרובע (aspect-ratio 1/1) — גדל עם הרוחב');
  ok(/#pieChart\s*\{[^}]*max-width:\s*4\d\dpx/.test(css), 'CSS: max-width גדול משמעותית מ-340px הישן');
  ok(/\.pie-leg-logo\s*\{/.test(css), 'CSS: מחלקת לוגו המקרא קיימת');

  // גרסאות
  const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
  ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');

  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('נכשל:', e && e.stack || e); process.exit(1); });
