// v271: פתיחה/סגירה של כרטיס מניה בסגנון אפל — עקומת קפיץ, דהיית התוכן, בלי ציור/מדידה באמצע האנימציה
const fs = require('fs');
const path = require('path');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const fn = (name) => { const i = app.indexOf('function ' + name + '('); let d = 0, j = app.indexOf('{', i); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && !--d) return app.slice(i, k + 1); } return ''; };

ok(/\.stock\s*\{\s*--ease-ios:\s*cubic-bezier\(\.32,\s*\.72,\s*0,\s*1\)/.test(css), 'עקומת קפיץ משותפת');
ok(/\.stock-body\s*\{[^}]*transition:\s*grid-template-rows\s*\.42s\s+var\(--ease-ios\)/.test(css), 'גובה הכרטיס בעקומת הקפיץ');
ok(/\.stock-body-in\s*\{[^}]*opacity:\s*0;[^}]*transform:\s*translateY\(-10px\)/.test(css), 'תוכן סגור: שקוף ומוזז מעט');
ok(/\.stock\.open \.stock-body-in\s*\{[^}]*opacity:\s*1;[^}]*transform:\s*none/.test(css), 'תוכן פתוח: מלא ובמקום');
ok(/\.stock\.measure[^{]*\{\s*transition:\s*none !important/.test(css), 'מצב מדידה בלי מעבר');
ok(/prefers-reduced-motion[^{]*\{[^}]*\.stock-body-in[^}]*transition:\s*none/.test(css), 'הפחתת תנועה');
ok(!/\.stock-head\s*\{\s*transition:[^}]*padding/.test(css), 'ריפוד הכותרת לא מונפש (משנה את מדידת הגובה)');

const tg = fn('toggleStock');
ok(/classList\.add\('open', 'measure'\);\s*fitCardToScreen\(sym, card\)/.test(tg), 'גובה הגרף נמדד כשהכרטיס פתוח במלואו');
ok(tg.indexOf("add('open', 'measure')") > 0 && tg.indexOf('ensureChartData(sym);', tg.indexOf("add('open', 'measure')")) > 0, 'הציור אחרי המדידה');
ok(!/classList\.add\('open'\);[^}]*fitCardToScreen/.test(tg.replace(/\n/g, ' ').split("classList.remove('measure')")[1] || ''), 'אין התאמה נוספת אחרי תחילת האנימציה');
const fit = fn('fitCardToScreen');
ok(/ResizeObserver\(\(\) => \{\s*if \(!state\.open\[sym\] \|\| card\.classList\.contains\('anim'\)\) return;/.test(fit), 'ResizeObserver לא מתאים באמצע האנימציה');

ok(/const KV_SUB_HOLD = '\\u00a0';/.test(app), 'שורה משנית שומרת מקום');
const kv = fn('kvGridHTML'), wkv = fn('watchKvHTML');
ok((kv.match(/KV_SUB_HOLD/g) || []).length === 2, 'רווח/הפסד ו־ATH בתיק שומרים גובה');
ok((wkv.match(/KV_SUB_HOLD/g) || []).length === 3, '52 שב׳ ו־ATH במעקב שומרים גובה');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
