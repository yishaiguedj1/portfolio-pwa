// pf-from-wheel.test.js — 20/11/2026: "מתאריך…" בגלגלת הטווחים של ביצועי התיק (כמו בכרטיס המניה), והמקרא בשורת הכותרת.
const fs = require('fs'), path = require('path');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const app = R('app.js'), css = R('styles.css');
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL - ' + m); } else console.log('ok - ' + m); };

ok(/const PF_YEAR_RANGES = \['year', '3y', '5y', 'max', 'custom'\];/.test(app), 'הגלגלת: "מתאריך" כפריט אחרון, כמו YEAR_RANGES בכרטיס המניה');
const yw = app.slice(app.indexOf('function pfYearWheel()'), app.indexOf('function rangeWheel('));
ok(/short: \(k\) => k === 'custom' \? CAL_ICON : esc\(pfShort\(k\)\)/.test(yw), 'הכפתור: אייקון לוח שנה');
ok(/long: \(k\) => k === 'custom' \? CAL_ICON \+ esc\(t\('srFrom'\)\)/.test(yw), 'הגלגלת: אייקון + "מתאריך…" (אותו טקסט כמו בכרטיס המניה)');
ok(/if \(k === 'custom'\) openPfFromSheet\(\); else pfPickRange\(k\);/.test(yw), 'בחירה ב"מתאריך" פותחת את גיליון התאריך');
ok(/if \(keys\[idxNow\(\)\] !== 'custom'\) commit\(\);/.test(app), 'גלילה (live) לא קובעת "מתאריך" באמצע — רק בסגירה');
const cl = app.slice(app.indexOf('function closePfSheet()'), app.indexOf('function openPfFromSheet()'));
ok(/_sync\(pfCurRange\(\)\)/.test(cl), 'ביטול הגיליון מחזיר את תווית הגלגלת לטווח שבפועל');
ok(/function renderPfTools/.test(app) === false && !/pfFromBtn'\)\)/.test(app.replace(/h\.textContent = t\('pfFromBtn'\)/, '')), 'אין עוד כפתור "תשואה מתאריך" בשורת הכלים');
ok(!/keyH|zoneR/.test(app), 'הגרף לא שומר מרווח למקרא צף');
ok(/\.pf-key \{[^}]*list-style: none;/.test(css) && !/\.pf-key \{[^}]*position: absolute/.test(css), 'המקרא בזרימה (לא צף על הגרף)');
console.log('\n' + n + ' בדיקות, ' + bad + ' נכשלו');
process.exit(bad ? 1 : 0);
