// v314: כריכה מתוך קובץ הספר + הגנה במחיקה כשמכתב עבר לקובץ אחר באותו מזהה (האחדת מכתבי באפט, 04/10/2026)
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

(async () => {
  // library.js מייבא את המנוע (דורש DOM) — הפונקציה הטהורה נלקחת ישירות מהטקסט
  const src = lib.match(/export function driveSyncPlan[\s\S]*?\n}\n/)[0].replace('export ', '');
  const driveSyncPlan = new Function(src + '; return driveSyncPlan;')();
  // מכתב שהוחלף בקובץ חדש בתיקייה אחרת (אותו מזהה ספר): הישן נעלם מהרשימה, החדש להורדה
  const local = [{ id: 'id-x', driveId: 'OLD', md5: 'a' }];
  const plan = driveSyncPlan(local, [{ id: 'NEW', md5: 'b', name: 'מכתב באפט 1987.epub' }]);
  ok(plan.fetch.length === 1 && plan.fetch[0].id === 'NEW' && plan.remove.length === 1, 'התוכנית: מורידים את החדש, הישן מסומן להסרה');
  // ההגנה: לפני מחיקה בודקים שהרשומה עדיין מצביעה על הקובץ שנעלם (אחרת היא כבר הקובץ החדש — לא מוחקים)
  ok(/const cur = \(await allBooksRaw\(\)\)\.find\(\(x\) => x\.id === b\.id\);\s+if \(!cur \|\| cur\.driveId !== b\.driveId\) continue;/.test(lib), 'מחיקה רק אם הספר עדיין מצביע על הקובץ שנעלם');
  const iRemove = lib.indexOf('for (const b of plan.remove)'), iFetch = lib.indexOf('await Promise.all([worker(), worker(), worker(), worker()])');
  ok(iFetch > 0 && iRemove > iFetch, 'ההורדות קודם, המחיקה אחריהן (כך ההגנה רואה את הרשומה המעודכנת)');
  // כריכה
  ok(/async function coverThumb\(book\)/.test(lib) && /book\.getCover/.test(lib), 'בייבוא נלקחת הכריכה מהקובץ');
  ok(/rec\.cover = cv\.blob; rec\.coverRatio = cv\.w \/ cv\.h;/.test(lib), 'הכריכה נשמרת ברשומה (תמונה מוקטנת + יחס)');
  ok(/Math\.min\(480, bmp\.width\)/.test(lib), 'מוקטנת לעד 480 פיקסלים (לא הקובץ המלא ב־IndexedDB)');
  ok(/URL\.revokeObjectURL/.test(lib), 'כתובת התמונה משתחררת כשהתמונה מתחלפת');
  ok(/\.lib-cover\.img img \{[^}]*object-fit: cover/.test(css), 'עיצוב לכריכה מתמונה');
  ok(/img-src [^;]*blob:/.test(html), 'ה־CSP מתיר תמונות blob: (הכריכה מוצגת מ־blob)');
  ok(!/localStorage[^\n]*cover/.test(lib), 'הכריכה לא נשמרת ב־localStorage');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
