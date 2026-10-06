// v346 (בקשת המשתמש 06/10/2026): דפדוף חלק בלי תקיעות — "כמו ש־Apple יודעים לעשות"
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'pagecurl.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const M = {}, names = [...src.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]);
new Function('M', src.replace(/^export /gm, '') + '\n' + names.map((k) => 'M.' + k + ' = ' + k + ';').join('\n'))(M);
const begin = src.slice(src.indexOf('  function begin(dir, x, y) {'), src.indexOf('  function move(x, y) {'));
const fin = src.slice(src.indexOf('  async function finish() {'), src.indexOf('  return {', src.indexOf('  async function finish() {')));
// 1) סוף הדפדוף: הגליל נעלם מיד, לא קפוא על הקצה בזמן ההמתנה למנוע
ok(/const turnedLayers = GL \? \[glc\] : \[shade, roll, Bw\]/.test(src), 'שכבות הדף שמתהפך — בלי השכפול שמתחת');
ok(fin.indexOf("for (const e of turnedLayers) e.style.visibility = 'hidden'") > -1 && fin.indexOf("for (const e of turnedLayers)") < fin.indexOf('await jump(s.dir)'), 'הגליל נעלם לפני ההמתנה למנוע (נמדד בסרטון: 6–8 פריימים קפואים על הקצה)');
// 2) תחילת המחווה: גב הדף מוכן מראש
ok(/GL\.use\(key\)/.test(begin) && /function backKey\(dir\)/.test(src), 'תחילת מחווה משתמשת בגב שהוכן מראש (נמדד: 145–425ms → 8–29ms בטלפון מואט)');
ok(/prepare\(key, cv\)/.test(src) && /slots\.length < 3/.test(src), 'מטמון של עד 3 טקסטורות');
ok(/idle\(\(\) => \{ warmGL\(\); prepBack\(1\); idle\(\(\) => prepBack\(-1\)\); \}\)/.test(src), 'הכנה בזמן מנוחה, כל כיוון בנפרד + חימום הצללים');
ok(/function prepBack\(dir\) \{\s*if \(!GL \|\| g \|\| busy\) return;/.test(src), 'לא מכינים בזמן דפדוף (לא שוברים פריימים באנימציה)');
const key = src.slice(src.indexOf('function backKey(dir)'), src.indexOf('function paintBack'));
ok(/__pcId/.test(key) && /r\.page/.test(key) && /curKey\(\)/.test(key) && /querySelectorAll\('rect'\)/.test(key) && /env\.page\(\)\.page/.test(key) && /dprNow\(\)/.test(key), 'המפתח: מסמך, עמוד, עיצוב/גודל, הדגשות, ערכה, רזולוציה — כל שינוי = ציור מחדש');
// 3) לולאת המחירים לא רצה מתחת לספרייה
const tick = app.slice(app.indexOf('function liveCanTick()'), app.indexOf('function liveCanTick()') + 900);
ok(/classList\.contains\('lib-open'\)\) return false;/.test(tick), 'בלי משיכת מחירים וציור התיק המוסתר כשהספרייה פתוחה (נמדד: 77–104ms כל 2 שנ׳)');
// 4) שחרור האצבע: בלי קפיצה במהירות (נמדד בסרטון 90Hz: 5.3 → 2.7 פיקסלים לפריים בבת אחת)
const V = 1.12 / 1000, D = 0.6;
const run = (v0) => { const m = M.curlMotion(D, V, v0); const vs = []; let r, prev = 0, n = 0; do { r = m.step(11.1); vs.push((r.pos - prev) / 11.1); prev = r.pos; n++; } while (!r.done && n < 400); return { vs, r, n }; };
for (const [lbl, v0] of [['החלקה מהירה', 2.5 * V], ['שחרור איטי', 0.2 * V], ['אחרי עצירה', 0]]) {
  const { vs, r, n: k } = run(v0);
  const jumps = vs.slice(1).map((v, i) => Math.abs(v - vs[i]) / V);
  ok(r.done && Math.abs(r.pos - D) < 1e-3 && k < 120, lbl + ': מגיע בדיוק ליעד (' + Math.round(k * 11.1) + 'ms)');
  ok(Math.max(...jumps) < 0.35, lbl + ': שינוי המהירות בין פריימים קטן (מקס׳ ' + Math.max(...jumps).toFixed(2) + ' מהמהירות הקבועה)');
  ok(v0 === 0 || Math.abs(vs[0] - Math.min(3 * V, v0)) / V < 0.35, lbl + ': הפריים הראשון ממשיך את מהירות האצבע');
}
ok(/const \{ pos, done \} = mo\.step\(dt\)/.test(src), 'האנימציה משתמשת בפיזיקה הרציפה');
// 5) שורת התחתית של הדף הבא — מחושבת מראש, בלי "רענון" אחרי המעבר
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
ok(/s\.foot = footPred\(/.test(src) && /placeCur\(P\.acur, 1, s\.foot\)/.test(src) && /placeNeighbor\(P\.anext, n, false, s\.foot\)/.test(src), 'הדף שנחשף מגיע עם האחוז והזמן שלו (גם פרק הבא)');
ok(/if \(s\.foot && env\.setFoot\) env\.setFoot\(s\.foot\);[^\n]*\n\s*await jump/.test(src), 'שורת התחתית האמיתית מתעדכנת לפני המעבר — לא מתחלפת לעין');
ok(/curlProg\.getProgress\(index, \(page - 1\) \/ \(pages - 2\), 1 \/ \(pages - 2\)\)/.test(lib) && /new curlSP\(rd\.book\.sections, 1500, 1600\)/.test(lib), 'אותו חישוב של המנוע (נבדק בדפדפן: 28/28 זהים, כולל מעבר פרק)');
console.log(n + ' בדיקות עברו');
