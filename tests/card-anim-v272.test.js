// v271→v272: פתיחה/סגירה של כרטיס מניה — חלקה לאורך כל הדרך, בלי קפיצות (בקשת המשתמש).
// v272: מנוע אחד ב־JS — גובה הכרטיס, כרטיס אחר שנסגר והגלילה באותו פריים ובאותה עקומת קפיץ.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const fn = (name) => { const i = app.indexOf('function ' + name + '('); let d = 0, j = app.indexOf('{', i); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && !--d) return app.slice(i, k + 1); } return ''; };

// עקומת הקפיץ: מתחילה ממהירות אפס, מונוטונית, מסתיימת ב־1 בדיוק
const ctx = {};
vm.runInNewContext(app.match(/const CARD_SPRING_W = [^\n]+\n/)[0] + app.match(/const cardEase = [^\n]+\n/)[0] + 'this.cardEase = cardEase;', ctx);
const E = ctx.cardEase;
ok(E(0) === 0 && E(1) === 1, 'קפיץ: 0→1');
ok(E(1 / 36) < 0.03, 'קפיץ: מתחיל ממהירות כמעט אפס (בלי זינוק בפריים הראשון)');
let mono = true, maxStep = 0;
for (let i = 1; i <= 36; i++) { const d = E(i / 36) - E((i - 1) / 36); if (d < 0) mono = false; maxStep = Math.max(maxStep, d); }
ok(mono, 'קפיץ: מונוטוני (בלי חריגה/חזרה)');
ok(maxStep < 0.1, 'קפיץ: אף פריים לא מזיז יותר מ־10% מהמרחק');

const tg = fn('toggleStock');
ok(/requestAnimationFrame\(frame\)/.test(tg) && /it\.body\.style\.height = \(it\.from \+ \(it\.to - it\.from\) \* e\)/.test(tg), 'גובה בכל פריים');
ok(/window\.scrollTo\(\{ top: S0 \+ \(S1 - S0\) \* e, behavior: 'instant' \}\)/.test(tg), 'גלילה באותה עקומה ובאותו פריים');
ok(/Math\.min\(maxFinal,/.test(tg) && /: Math\.min\(S0, maxFinal\)/.test(tg), 'גלילת היעד לא עוברת את גבול הדף הסופי (בלי קפיצה בסוף)');
ok(/closeStockCards\(sym, null, true\)/.test(tg) && /closing: true/.test(tg), 'כרטיס פתוח אחר נסגר באותה תנועה');
ok(/if \(t0 === null\) t0 = now;/.test(tg), 'הזמן מתחיל מהפריים הראשון המצויר');
ok(/for \(const ev of evs\) window\.addEventListener\(ev, stopSteer/.test(tg), 'נגיעה/גלילה של המשתמש עוצרת את ניווט הגלילה');
ok(/classList\.add\('open', 'measure'\);\s*fitCardToScreen\(sym, card\)/.test(tg), 'גובה הגרף נמדד פתוח במלואו לפני הציור');
ok(/if \(state\.cardAnim\) return false;/.test(fn('liveCanTick')), 'המחירים החיים לא מציירים באמצע האנימציה');
ok(/if \(state\.cardAnim\) return;/.test(fn('scrollCardToTop')), 'אין גלילה מתחרה בזמן האנימציה');
ok(/if \(!state\.open\[sym\] \|\| card\.classList\.contains\('anim'\)\) return;/.test(fn('fitCardToScreen')), 'ResizeObserver לא מתאים באמצע האנימציה');

ok(!/\.stock-body \{[^}]*transition:\s*grid-template-rows/.test(css), 'אין מעבר CSS לגובה (הוא ב־JS)');
ok(/\.stock\.measure \.stock-body \{ height: auto !important; \}/.test(css), 'מדידה מתעלמת מהגובה הזמני');
ok(/--ease-spring: linear\(0\.000,/.test(css) && /\.stock-head \{ transition:[^}]*padding \.6s var\(--ease-spring\)/.test(css), 'הכותרת באותו קפיץ ומשך (600ms)');
ok(/const CARD_ANIM_MS = 600;/.test(app), 'משך 600ms');
ok(/prefers-reduced-motion[^{]*\{[^}]*\.stock-body-in[^}]*transition:\s*none/.test(css) && /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/.test(tg), 'הפחתת תנועה');

ok(/const KV_SUB_HOLD = '\\u00a0';/.test(app), 'שורה משנית שומרת מקום');
ok((fn('kvGridHTML').match(/KV_SUB_HOLD/g) || []).length === 2 && (fn('watchKvHTML').match(/KV_SUB_HOLD/g) || []).length === 3, 'אריחים שומרים גובה בתיק ובמעקב');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
