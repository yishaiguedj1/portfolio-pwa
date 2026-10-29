// 21/10/2026 (סרטון המשתמש): הבורר של Academy קפץ אל שורת החיפוש אחרי מעבר בין הספריות — barHeightVar מדד את ההדר
// באמצע הקובייה (מלבן מסובב, ~218 במקום 122) או את ההעתק של המעבר. עכשיו: offsetHeight, בלי cube-ghost / cube-hold.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const src = app.slice(app.indexOf('let _barHEl'), app.indexOf('/* </core> */', app.indexOf('let _barHEl')));
ok(/function barHeightVar\(/.test(src), 'barHeightVar נמצאת');

const mk = (h, rect, inGhost) => ({ isConnected: true, offsetHeight: h, getBoundingClientRect: () => ({ height: rect }), closest: (s) => (inGhost && /cube-ghost/.test(s) ? {} : null) });
const vars = {};
let bars = [];
const ctx = { document: { querySelector: () => bars[0], querySelectorAll: () => bars, documentElement: { style: { setProperty: (k, v) => { vars[k] = v; } } } }, ResizeObserver: function () { this.observe = () => {}; this.disconnect = () => {}; } };
vm.createContext(ctx);
vm.runInContext(src + '\nthis.barHeightVar = barHeightVar;', ctx);

bars = [mk(122, 218, false)];
ctx.barHeightVar();
ok(vars['--appbar-h'] === '122px', 'הדר מסובב בקובייה — הגובה בפריסה (122), לא המלבן (218)');
bars = [mk(122, 218, true), mk(118, 118, false)];
ctx.barHeightVar();
ok(vars['--appbar-h'] === '118px', 'ההעתק של המעבר (cube-ghost) ראשון ב־DOM — מודדים את ההדר האמיתי');
ok(!/\.lib-seg/.test(css) && /\.lib-home > \.appbar \{ margin-bottom: 12px; \}/.test(css), 'Academy: הבורר הדבוק הוסר (29/10/2026 — החוגה בתחתית); הרווח מתחת להדר נשאר');
console.log(n + ' בדיקות עברו');
