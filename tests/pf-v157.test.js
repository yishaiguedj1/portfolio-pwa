// pf-v157.test.js — מניות ת"א: המחיר מוזן באגורות (כמו הציטוט בבורסה), נשמר בשקלים; תיקון נתונים ישנים שהוזנו באגורות.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
function grab(name) {
  const i = src.indexOf('function ' + name + '(');
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
}
const f = new Function('t', ['symCur', 'pxInFactor', 'pxFromInput', 'pxToInput', 'pxUnit', 'fixAgorotEntries'].map(grab).join('\n') +
  'return { pxFromInput, pxToInput, pxUnit, fixAgorotEntries };')((k) => (k === 'agorotUnit' ? 'אגורות' : k));

ok(f.pxFromInput('TSEM.TA', 68240) === 682.4, 'ת"א: 68,240 אגורות → ₪682.40');
ok(f.pxFromInput('NVDA', 180.5) === 180.5, 'ארה"ב: דולר כמו שהוא');
ok(f.pxToInput('TSEM.TA', 682.4) === '68240', 'עריכה: מוצג שוב באגורות');
ok(f.pxToInput('TEVA.TA', 120.555) === '12055.5', 'בלי שגיאות נקודה צפה');
ok(f.pxToInput('AAPL', 201.3) === '201.3' && f.pxToInput('X.TA', null) === '', 'ארה"ב / ריק');
ok(f.pxUnit('LUMI.TA') === 'אגורות' && f.pxUnit('MSFT') === '$', 'יחידה בתווית');

const db = {
  positions: [
    { sym: 'TSEM.TA', shares: 5, avg: 60000 },            // הוזן באגורות לפני v157
    { sym: 'TEVA.TA', shares: 5, avg: 118 },              // תקין
    { sym: 'NVDA', shares: 1, avg: 18000 },               // לא ת"א — לא נוגעים
    { sym: 'LUMI.TA', shares: 1, avg: 0, fromTrades: true },
  ],
  manualTrades: [
    { sym: 'LUMI.TA', price: 3500, qty: 1 },              // אגורות
    { sym: 'lumi.ta', price: 36, qty: 1 },                // תקין
  ],
};
const px = { 'TSEM.TA': 682.4, 'TEVA.TA': 120.5, NVDA: 180, 'LUMI.TA': 36.2 };
ok(f.fixAgorotEntries(db, (s) => px[s]) === 2, 'שני מחירים באגורות זוהו');
ok(db.positions[0].avg === 600 && db.positions[1].avg === 118 && db.positions[2].avg === 18000, 'ממוצע: רק החשוד תוקן');
ok(db.manualTrades[0].price === 35 && db.manualTrades[1].price === 36, 'עסקאות: רק החשודה תוקנה');
ok(f.fixAgorotEntries(db, (s) => px[s]) === 0, 'ריצה חוזרת — כלום (לא מחלק פעמיים)');
ok(f.fixAgorotEntries({ positions: [{ sym: 'X.TA', avg: 5000 }] }, () => null) === 0, 'בלי מחיר חי — לא נוגעים');
ok(f.fixAgorotEntries({ positions: [{ sym: 'X.TA', avg: 500 }] }, () => 20) === 0, 'פי 25 — יכול להיות אמיתי, לא נוגעים');

ok(/pxFromInput\(p\.sym, parseFloat\(body\.querySelector\('#ep-avg'\)/.test(src), 'עריכת מניה: אגורות → שקלים');
ok(/avg = pxFromInput\(sym, parseFloat\(card\.querySelector\('#ap-avg'\)/.test(src) && /price: pxFromInput\(sym, parseFloat\(card\.querySelector\('#ap-price'\)/.test(src), 'הוספת מניה: שני המצבים');
ok(/price: pxFromInput\(card\.querySelector\('\.mt-sym'\)\.value\.trim\(\), parseFloat/.test(src) && /pxToInput\(tr\.sym, tr\.price\)/.test(src), 'טופס עסקה: שמירה ועריכה');
ok(/class="cur-px"/.test(src) && /function pxHints/.test(src), 'תווית "אגורות" + "= ₪…" מתחת לשדה');
ok(/fixAgorotEntries\(\{ positions: POSITIONS, manualTrades: mtList\(\) \}/.test(src) && /if \(!isDemoMode\(\)\)/.test(src), 'תיקון ישן ב־renderAll (לא בדמו)');
ok(/agorotUnit: 'agorot'/.test(src) && /agorotFixed: 'Fixed/.test(src), 'אנגלית');
ok(/ICON_FILTER \+ esc\(t\('srcFilterBtn'\)\)/.test(src), 'כפתור הסינון תמיד "סינון" (גם כשמסונן)');
console.log('\n' + n + ' בדיקות עברו');
