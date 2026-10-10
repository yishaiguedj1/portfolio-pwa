// v378: סטודיו התרגום — מגדל הפיקוח 2.0, סבב "בדיקת מוכנות ותחזוקה" (ServiceNow: Instance Scan · CMDB Health):
// בדיקות בלי טוקנים (החיבור ל־Claude, Drive, מקום פנוי, מכסת ההפעלות, התקציב לעבודה) וניקיון (תיקיות של עבודות שנמחקו,
// תיקיות כפולות, נקודות שמירה של עבודות שהסתיימו, רשומות ישנות). ממצאים עם עדיפות 1–5, ציון, "נקה" לפח של Drive.
// הבדיקות המלאות (מול Drive מדומה): ibkr-proxy/tests/run.js (בלוק v378).
// הרצה: node tests/studio-v378.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. השרתון ---------- */
  const SC = require(path.join(root, 'ibkr-proxy/lib/studioscan.js'));
  const st = await import(path.join(root, 'studio.js'));
  ok(SC.PASS === 70 && SC.PEN[1] === 30 && SC.PEN[5] === 1, 'ציון: קנס לפי עדיפות, מעבר מ־70 (כמו מדד האיכות)');
  ok(Object.values(SC.KINDS).every((x) => SC.CHECK_KEYS.includes(x.ch) && x.p >= 1 && x.p <= 5), 'כל סוג ממצא שייך לבדיקה, עם עדיפות 1–5');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/op === 'scan'/.test(api) && /op === 'clean'/.test(api) && /SC\.CLEAN_KINDS\.includes\(k\)/.test(api), 'op scan / clean — רק סוגי ניקוי מוכרים');
  ok(/const other = await readJob\(deps, f\.job\)/.test(api), 'תיקייה של עבודה שקיימת אצל משתמש אחר — לא נוגעים');
  ok(/trashed: true/.test(api) && !/method: 'DELETE'[^\n]*drive/i.test(api), 'נקה = לפח של Drive (אפשר לשחזר), לא מחיקה');
  ok((api.match(/await removeJobRec\(/g) || []).length === 2, 'מחיקת רשומה — פונקציה אחת ("מחיקה" ורשומות ישנות)');
  ok(/sc: await scFor\(uid\)/.test(api) && /'sc'(, 'et', 'ep')?\]/.test(read('ibkr-proxy/lib/studio.js')), 'הסריקה האחרונה נשמרת ומוצגת ב־status');

  /* ---------- 2. הטלפון ---------- */
  const v = st.normScan({ at: 5, s: 86, n: 9, ok: ['claude', 'evil'], f: [{ k: 'orphans', p: 4, ch: 'orphans', n: 4, b: 1.8e9 }, { k: 'evil', p: 1 }, { k: 'ck', p: 9 }], fb: 1.8e9 });
  ok(v && v.s === 86 && v.f.length === 1 && v.ok.join() === 'claude' && v.f[0].b === 1.8e9, 'normScan: תקין; סוג / עדיפות לא מוכרים — נזרקים');
  ok(st.normScan(null) === null && st.normScan({ at: 'x' }) === null && st.normScan({ at: 1, s: 900 }).s === 100, 'normScan: בלי זמן — null; ציון חסום ל־100');
  ok(st.chainFor('scan').map((x) => x.v).join() === 'home,settings,tower,scan', 'רענון בדף הבדיקה — חוזר דרך המגדל');
  const sj = read('studio.js');
  ok(/p\.append\(\.\.\.scanSection\(\)\)/.test(sj) && /else if \(ui\.view === 'scan'\) pageScan\(p\)/.test(sj), 'מגדל: שורת מוכנות → דף');
  ok(/askConfirm\(scCleanQ\(x\), go2, \{ danger: true/.test(sj) && /askConfirm\(T\('studioScQAll'\), doIt, \{ danger: true/.test(sj), 'נקה — תמיד באישור הרסני');
  // כל סוג ממצא בשרתון — עם כותרת בטלפון (מחרוזות קבועות, בלי T(משתנה))
  for (const k of Object.keys(SC.KINDS)) ok(k === 'old' ? /default: return \[one \? T\('studioScOld1'\)/.test(sj) : sj.includes("case '" + k + "': return ["), 'תווית לממצא ' + k);
  for (const k of SC.CHECK_KEYS) ok(sj.includes("case '" + k + "'") || k === 'old', 'שם לבדיקה ' + k);
  ok(SC.CLEAN_KINDS.join() === "orphans,dupes,ck,old" && /const SC_CLEAN = \['orphans', 'dupes', 'ck', 'old'\]/.test(sj), 'סוגי הניקוי זהים בשרתון ובטלפון');
  // בלי כפילות: עבודות תקועות ומתג החירום מוצגים במקום אחר — לא בבדיקה
  ok(!('stale' in SC.KINDS) && !Object.keys(SC.KINDS).some((k) => /halt|stuck/.test(k)), 'בלי כפילות: עבודות תקועות ומתג החירום לא בבדיקת המוכנות');
  const app = read('app.js');
  const keys = [...new Set((sj.match(/T\('(studioSc[A-Za-z0-9]+)'/g) || []).map((x) => x.slice(3, -1)))];
  ok(keys.length > 50, 'יש מחרוזות לבדיקה (' + keys.length + ')');
  for (const k of keys) ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');

  /* ---------- 3. גרסה ---------- */
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  const sw = (read('sw.js').match(/CACHE_NAME = '[^']*-(v\d+)'/) || [])[1];
  ok(+ver.slice(1) >= 378 && swVersionOk(ver, sw), 'APP_VERSION ≥ v378 ו־sw.js תואם או גרסה אחת אחורה');
  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
