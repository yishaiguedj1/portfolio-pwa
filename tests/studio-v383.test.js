// v383: סטודיו התרגום — מגדל הפיקוח 2.0, תקציב שגיאות (ServiceNow: Service Reliability · error budget · burn rate).
// יעד: 95% מהעבודות בלי התערבות (30 יום); כמה נשאר, קצב שריפה ב־7 ימים, העבודות שאכלו ממנו. בלי טוקנים ובלי קריאה נוספת.
// הבדיקות המלאות: ibkr-proxy/tests/run.js (בלוק v383).
// הרצה: node tests/studio-v383.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. השרתון ---------- */
  const api = read('ibkr-proxy/api/studio.js');
  ok(/slo: SLO\.sloView\(list, now\)/.test(api), 'השרתון: התקציב מחושב מאותה רשימה של op:jobs (בלי קריאה נוספת)');
  const SLO = require(path.join(root, 'ibkr-proxy/lib/studioslo.js'));
  ok(SLO.SLO_T === 0.95 && SLO.MIN_N === 5, 'יעד 95%, מ־5 עבודות');

  /* ---------- 2. הטלפון ---------- */
  const st = await import(path.join(root, 'studio.js'));
  const J = 'j' + 'A'.repeat(20);
  const v = st.normSlo({ t: 95, n: 20, bad: 2, left: 0, burn: 2.5, n7: 6, st: 'out', min: 5, list: [{ j: J, c: 'fail', at: 5 }, { j: 'evil', c: 'fail' }, { j: J, c: 'x' }] });
  ok(v && v.good === 18 && v.att === 90 && v.list.length === 1 && v.burn === 2.5, 'normSlo: מספרים עקביים, רק עבודות וסיבות מוכרות');
  ok(st.normSlo({ st: 'evil', n: 1 }) === null && st.normSlo(null) === null && st.normSlo({ st: 'ok', n: 3, bad: 9 }).bad === 3, 'normSlo: מצב לא מוכר — כלום; "השתמשו" לא מעבר למספר העבודות');
  ok(JSON.stringify(st.chainFor('slo').map((x) => x.v)) === '["home","settings","tower","slo"]', '"חזור": תקציב שגיאות ← המגדל');
  const sj = read('studio.js');
  ok(/p\.append\(\.\.\.sloSection\(\)\);/.test(sj) && /else if \(ui\.view === 'slo'\) pageSlo\(p\);/.test(sj), 'המגדל: שורה אחת → דף התקציב');
  ok(/hero = h\('div', 'st-schero'\)/.test(sj.slice(sj.indexOf('function pageSlo('))), 'הדף: אותו כרטיס ציון של בדיקת המוכנות (בלי עיצוב חדש)');
  ok(!/studioVaAbRs/.test(sj) && !/studioVaAbRs/.test(read('app.js')), 'בלי כפילות: "עברו המשך" עבר מדף הערך לתקציב השגיאות');
  ok(!/innerHTML/.test(sj.slice(sj.indexOf('function sloSection('), sj.indexOf('function valueSection('))), 'הדף בונה רק טקסט');
  const app = read('app.js');
  for (const k of [...new Set((sj.match(/T\('studioSlo[A-Za-z]+'/g) || []).map((x) => x.slice(3, -1)))])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k);

  /* ---------- 3. גרסה ---------- */
  const ver = (app.match(/APP_VERSION = '(v\d+)'/) || [])[1] || '';
  ok(+ver.slice(1) >= 383 && swVersionOk(ver), 'APP_VERSION ≥ v383 ו־sw.js תואם (או גרסה אחת אחורה)');
  console.log('\n' + n + ' passed');
})().catch((e) => { console.error(e); process.exit(1); });
