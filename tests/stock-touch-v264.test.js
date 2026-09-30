// stock-touch-v264.test.js — נגיעה בגרף המניה: אצבע אחת = מחיר ותאריך, שתי אצבעות = מדידת תשואה (כמו בגוגל)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const sb = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, style: {} }) }, window: {}, navigator: {}, location: { origin: 'https://yishaiguedj1.github.io', pathname: '/portfolio-pwa/' }, AbortController, fetch: () => Promise.reject(new Error('x')), setTimeout, clearTimeout, console, TextEncoder, Image: class { set src(_) {} } };
vm.createContext(sb); vm.runInContext(app, sb);
const R = (c) => vm.runInContext(c, sb);
const strip = (s) => String(s).replace(/[⁦-⁩]/g, '');
const map = { n: 5, padL: 6, plotW: 400 };
ok(R('scIdx(' + JSON.stringify(map) + ', 6)') === 0 && R('scIdx(' + JSON.stringify(map) + ', 406)') === 4 && R('scIdx(' + JSON.stringify(map) + ', 206)') === 2, 'מיקום אצבע → הנקודה הקרובה בגרף');
ok(R('scIdx(' + JSON.stringify(map) + ', -50)') === 0 && R('scIdx(' + JSON.stringify(map) + ', 9999)') === 4, 'מחוץ לגרף — נצמד לקצה');
const pts = JSON.stringify([{ date: '2026-01-02', close: 100 }, { date: '2026-02-02', close: 80 }, { date: '2026-03-02', close: 120 }]);
let m = R('scMeasure(' + pts + ', 2, 0)');
ok(m.a === 0 && m.b === 2 && Math.abs(m.pct - 20) < 1e-9 && m.chg === 20, 'מדידה: לפי סדר הזמן גם כשהאצבע הימנית נגעה קודם');
m = R('scMeasure(' + pts + ', 2, 1)');
ok(Math.abs(m.pct - 50) < 1e-9, 'מדידה בין שתי נקודות — תשואה מהראשונה לשנייה');
m = R('scMeasure(' + pts + ', 0, 1)');
ok(Math.abs(m.pct + 20) < 1e-9 && m.chg === -20, 'ירידה — תשואה שלילית');
ok(R("scDateTxt({ date: '2026-07-15' }, false)") === '15/07/2026', 'תאריך מלא בגרף יומי');
ok(R("scDateTxt({ date: '2026-07-15', time: '10:35:00' }, 'day')") === '10:35 · 15/07', '1D — שעה ותאריך');
ok(R("scDateTxt({ date: '2026-07-15', time: '10:30:00' }, '5d')") === '15/07 10:30', '5D — יום ושעה');
ok(strip(R("scPxTxt('NOW', 104.73)")) === '$104.73' && /7,212/.test(R("scPxTxt('LUMI.TA', 72.12)")) && /3,265\.58/.test(R("scPxTxt('^GSPC', 3265.58)")), 'מחיר ביחידת הגרף: דולר / אגורות / נקודות');
ok(/scAttach\(canvas, sym\);/.test(app) && /scRender\(canvas\);/.test(app), 'מחובר לכל כרטיס מניה (תיק ורשימות מעקב — אותו buildStockCard) ונשמר בציור מחדש');
ok(/xs\.length >= 2/.test(app) && /pointercancel/.test(app), 'שתי אצבעות = מדידה; גלילת הדף מבטלת נגיעה של אצבע אחת');
ok(/\.stock-body \.chart-wrap canvas, #pfChart \{ touch-action: pan-y;/.test(css), 'גלילה אנכית של הדף נשארת מעל הגרף');
ok(/scTwoFingerHint: 'טיפ/.test(app) && /scTwoFingerHint: 'Tip/.test(app), 'טיפ חד־פעמי בעברית ובאנגלית');
// v265
ok(/base: base \}/.test(app) && /map\.pts\[i\]\.close \/ map\.base - 1/.test(app), 'v265: בבועה גם השינוי עד אותו רגע (מתחילת הטווח; 1D מהסגירה הקודמת)');
ok(/translate\(0px,' \+ \(-tip\.offsetHeight - 4\)/.test(app) && /tip\.style\.top = \(-tip\.offsetHeight - 4\)/.test(app), 'v265: הבועה בשני הגרפים — פינה שמאלית עליונה, מעל הגרף');
ok(/pf-tip sc-tip/.test(app) && /radial-gradient\(circle, var\(--on-surface-var\)/.test(css), 'v265: עיצוב הבועה של גרף הביצועים + קו אנכי מנוקד');
ok(/pfAttachTouch\(canvas\)/.test(app) && /showPfMeasureTip\(a, b\)/.test(app) && /!ms\.on \|\| ms\.pts\.length < 2/.test(app), 'v265: גרף הביצועים — שתי אצבעות = מדידה בבועה (שורת המדידה רק במצב הכפתור)');
// v266
ok(/function pfPickConfirm\(\)/.test(app) && /state\.pfCustomFrom = map\.series\[0\]\.pts\[i\]\.date;/.test(app) && /go\.disabled = !picked;/.test(app), 'v266: סימון בגרף הסקירה — "המשך" פעיל רק אחרי סימון, קובע את תאריך ההתחלה');
ok(/if \(state\.pfPickDate\) \{ \/\/ v266/.test(app) && /pickAt\(xOf\(e\)\)/.test(app), 'v266: הסימון זז בנגיעה ובגרירה בלי הגבלה (בלי חלון אישור)');
ok(/pfPickContinue: 'המשך'/.test(app) && /pfPickContinue: 'Continue'/.test(app), 'v266: "המשך" בעברית ובאנגלית');
console.log('\n' + n + ' בדיקות עברו');
