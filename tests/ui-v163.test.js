// ui-v163.test.js — דמו: היסטוריה מהשרתון בבקשה אחת (Yahoo חוסם את הטלפון), גיבוי לגרפים, והתקדמות בתוך כרטיס הדמו.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'ibkr-proxy', 'vercel.json'), 'utf8'));
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
function grab(name) {
  const i = src.indexOf('function ' + name + '(');
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
}
const rows = new Function(grab('proxyHistoryRows') + 'return proxyHistoryRows;')();
const r = rows({ SPY: { t: [20000, 20001], c: [100.5, 0] }, BAD: { t: 'x' } });
ok(r.SPY.length === 1 && r.SPY[0].date === '2024-10-04' && r.SPY[0].close === 100.5 && !r.BAD, 'המרת תשובת השרת לשורות (יום מ־1970 → תאריך, בלי ריקים)');
ok(/const got = await proxyHistory\(part, '7y', 25000\);/.test(src) && /i \+= 40\) parts\.push\(syms\.slice\(i, i \+ 40\)\)/.test(src), 'דמו: הסימבולים לשרת בבקשות של עד 40 (v168: ~57 סימבולים)');
ok(/const missing = syms\.filter\(\(s\) => !hist\[s\]\);/.test(src) && /histProxyOff = true;/.test(src), 'רק מה שחסר — ישירות, בלי לשאול את השרת שוב על כל מניה');
ok(/const px = await proxyHistQueued\(sym\);/.test(src), 'גרפים רגילים: גיבוי דרך השרת כש־Yahoo ו־Stooq לא עונים');
ok(/proxyHistQ\.timer = setTimeout\(async \(\) => \{/.test(src) && /slice\(0, 40\)/.test(src), 'גיבוי: כמה מניות באותו רגע = בקשה אחת (עד 40)');
ok(/method: 'POST', headers: ibkrProxyHeaders\(\)/.test(src), 'אותה שמירת גישה כמו IBKR');
ok(vercel.functions['api/history.js'] && vercel.functions['api/history.js'].maxDuration === 30, 'Vercel: הפונקציה מוגדרת');
ok(!/demoProgVeil|demo-prog-veil/.test(src + css), 'בלי חלון צף');
ok(/card\.classList\.add\('building'\);/.test(src) && /\.demo-card\.building > :not\(\.demo-inline\) \{ display: none; \}/.test(css), 'ההתקדמות בתוך כרטיס הדמו');
ok(/data-act="retry"/.test(src) && /demoCreate\(null, true\)/.test(src) && /demoRetry: 'Try again'/.test(src), 'כשל: "נסו שוב" בתוך הכרטיס (בלי לשאול שוב)');
ok(/demoStepServer: 'מהשרת — בבקשה אחת'/.test(src), 'מציג מאיפה מגיעים הנתונים');
ok(/if \(yahooCooling\(\)\) \{ const pr = await viaProxy\(\); if \(pr\) return save\(pr\); \}/.test(src), 'גרף מניה (getDaily): Yahoo חוסם → ישר לשרת');
ok(/if \(!yahooCooling\(\)\) \{ const pr = await viaProxy\(\); if \(pr\) return save\(pr\); \}/.test(src), 'גרף מניה: השרת כגיבוי אחרי Yahoo ו־Stooq');
ok(/if \(!histProxyOff\) \{\s*proxyTried = true;/.test(src) && /if \(!proxyTried\) try \{/.test(src), 'גרף הביצועים: בלי בקשה כפולה לשרת (v193: השרתון ראשון תמיד, ישירות רק כגיבוי)');
console.log('\n' + n + ' בדיקות עברו');
