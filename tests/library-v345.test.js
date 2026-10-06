// v345 (בקשת המשתמש 06/10/2026): תנועת הדפדוף אחד לאחד כמו בקינדל — לפי מדידה פריים־פריים בסרטונים של המשתמש
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const src = fs.readFileSync(path.join(__dirname, '..', 'pagecurl.js'), 'utf8');
const M = {}, names = [...src.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]);
new Function('M', src.replace(/^export /gm, '') + '\n' + names.map((k) => 'M.' + k + ' = ' + k + ';').join('\n'))(M);
// קינדל: מהירות קבועה מהשחרור, בלימה רק ב־~5% האחרונים
const D = 0.6, N = 60, xs = [];
for (let i = 0; i <= N; i++) xs.push(M.kindleEase(i / N, D) * D);
const v = xs.slice(1).map((x, i) => x - xs[i]);
const vMid = v[Math.floor(N / 2)];
ok(xs[0] === 0 && Math.abs(xs[N] - D) < 1e-9, 'מתחיל במקום ומסיים בדיוק ביעד');
ok(v.every((d) => d >= -1e-12), 'תנועה רק קדימה');
const lin = v.filter((d) => Math.abs(d - vMid) < 1e-9).length;
ok(lin / v.length > 0.8, 'מהירות קבועה ברוב הזמן (' + Math.round(100 * lin / v.length) + '% מהפריימים) — כמו בקינדל, לא "זנב" איטי');
const brakeDist = D - xs[v.findIndex((d) => d < vMid - 1e-9)];
ok(brakeDist <= M.BRAKE + vMid + 1e-9 && brakeDist > 0.02, 'בלימה רק בקצה (' + brakeDist.toFixed(3) + ' מרוחב המסך)');
ok(v[N - 1] < vMid * 0.2, 'נעצר ברכות (לא נחיתה חדה)');
ok(Math.abs(M.rushDur(D, 1.12, 0) - (D + M.BRAKE) / 1.12 * 1000) < 1e-6, 'משך = דרך + בלימה במהירות קבועה');
// מהירות: קינדל 1.37 רוחבי מסך/שנ׳ — אצלנו קצת יותר לאט (בקשת המשתמש)
const sp = Number((/const SPEED = ([\d.]+)/.exec(src) || [])[1]);
ok(sp < 1.37 && sp > 1.37 * 0.7, 'מהירות ' + sp + ' — קצת יותר איטית מהקינדל (1.37)');
ok(/const T_GL = 0\.25/.test(src), 'כנף ~25% מהמסך בדפדוף האוטומטי (נמדד בקינדל)');
ok(!/curlEase\(k, m0\)/.test(src), 'בלי עקומת Hermite עם הזנב האיטי');
ok(/const target = \(go \? s\.dir > 0 : s\.dir < 0\) \? 1 \+ EDGE_R \* curlRadius\(s\.W\) \/ s\.W/.test(src) && M.EDGE_R > 0 && M.EDGE_R < 1, 'הגליל נעצר על קצה המסך (הבלימה נראית, כמו בקינדל) — לא מחוץ למסך');
console.log(n + ' בדיקות עברו');
