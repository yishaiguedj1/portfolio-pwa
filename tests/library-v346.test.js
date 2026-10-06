// v346 (בקשת המשתמש 06/10/2026): דפדוף חלק בלי תקיעות — "כמו ש־Apple יודעים לעשות"
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'pagecurl.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
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
console.log(n + ' בדיקות עברו');
