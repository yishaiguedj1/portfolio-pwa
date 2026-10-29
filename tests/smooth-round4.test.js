// 29/10/2026 — סבב קפיצות 4 (שבעה סרטונים מהטלפון): פריים ריק/שחור בתחילת מעבר, כרטיס החשבון לפני שהחיבור נבדק,
// בועת הגיבוי ב־Academy, הלוגו בהדר, ורשימת המעקב בגרף. פירוט: docs/smooth-plan.md סעיף 10
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const rd = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const app = rd('app.js'), core = rd('core.js'), lib = rd('library.js'), st = rd('studio.js'), an = rd('analysis.js');
const shell = rd('shell.js'), cloud = rd('cloud.js'), chart = rd('chart.js');
const fn = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return ''; };

// ---- cubePre: ההעתק נצבע (שקיפות 0.01) שני פריימים לפני שהדף מצויר מחדש
ok(/function cubePre\(/.test(core) && /const cubePreBusy = /.test(core), 'cubePre ו־cubePreBusy ב־core.js (Academy/Studio)');
{
  const raf = [];
  const ghost = { style: { opacity: '' }, removed: false, remove() { this.removed = true; } };
  const ctx = { CUBE_WARM_OP: '0.01', document: { hidden: false }, requestAnimationFrame: (f) => raf.push(f), cubeClone: () => ghost };
  vm.runInNewContext('let _cubePre = null;' + fn(app, 'cubePre') + 'this.cubePre = cubePre; this.busy = () => !!_cubePre;', ctx);
  let got = null;
  ctx.cubePre({}, (g) => { got = g; });
  ok(got === null && ghost.style.opacity === '0.01' && ctx.busy(), 'בהתחלה: ההעתק שקוף כמעט לגמרי, והדף עוד לא מצויר מחדש');
  raf.shift()();
  ok(got === null, 'אחרי פריים אחד — עדיין מחכים');
  raf.shift()();
  raf.length && raf.shift()();
  ok(got === ghost && ghost.style.opacity === '' && !ctx.busy(), 'אחרי שני פריימים: ההעתק גלוי והציור החדש רץ');
  // קריאה שנייה בזמן ההמתנה — הראשונה רצה מיד
  const order = [];
  ctx.cubePre({}, () => order.push(1));
  ctx.cubePre({}, () => order.push(2));
  ok(order.join() === '1', 'מעבר שני בזמן ההמתנה: הראשון רץ מיד (בלי שני ניווטים במקביל)');
}
ok(/cube: \{ clone: cubeClone, pre: cubePre,/.test(app), 'הניתוח מקבל את cubePre מה־env');
ok(/C\.pre\(ROOT, \(ghost\) =>/.test(an), 'הניתוח: מעבר בלחיצה דרך cubePre');
ok(/await new Promise\(\(res\) => cubePre\(root, res\)\)/.test(fn(lib, 'cubeNav')), 'Academy: cubeNav דרך cubePre');
ok(/cubePre\(root, \(g\) =>/.test(fn(st, 'render')) && /if \(pre\) pre\.remove\(\)/.test(fn(st, 'render')), 'Studio: render דרך cubePre, וההעתק יורד אם הציור בוטל');
ok(/cubePreBusy\(\)\) return;/.test(fn(st, 'render')), 'Studio: ציור במקום בזמן ההמתנה מחכה');
ok(/s\.pre = cubePre\(root,/.test(fn(app, 'snbSwipe')) && /if \(s\.pre\) s\.pre\.now\(\)/.test(fn(app, 'snbSwipe')), 'ההחלקה: ההעתק מוכן לפני השכן, ושחרור מוקדם בונה מיד');
ok(/c\.pre = cubePre\(root, build\)/.test(lib) && /c\.pre = cubePre\(root, build\)/.test(st), 'החוגה (Academy/Studio): קובייה ממתינה עד שההעתק נצבע');
ok((lib.match(/if \(c\.pre\) c\.pre\.now\(\);/g) || []).length === 2 && (st.match(/if \(c\.pre\) c\.pre\.now\(\);/g) || []).length === 2, 'החוגה: land/drop משלימים קודם את ההכנה');

// ---- כרטיס החשבון: הפרטים מהחיבור האחרון עד שהחיבור נבדק
ok(/'pwa_accprof_v1'/.test(app.match(/const ACCOUNT_KEYS = \[[^\]]*\]/)[0]), 'pwa_accprof_v1 ב־ACCOUNT_KEYS (לפי חשבון)');
ok(/LS_ACC_PROF/.test(fn(cloud, 'renderAccountCard')) && /!authSettled/.test(fn(cloud, 'renderAccountCard')), 'Invest: בלי "חיבור ענן לא הוגדר" לפני שה־SDK נטען');
ok(/localStorage\.removeItem\(LS_ACC_PROF\)/.test(cloud), 'Invest: לא מחובר באמת — הפרטים נמחקים');
ok(/st === 'boot'/.test(fn(shell, 'accountCard')) && /removeItem\(ACC_PROF\)/.test(fn(shell, 'accountCard')), 'Academy/Studio: בזמן הבדיקה — הפרטים מהפעם הקודמת; לא מחובר — נמחקים');

// ---- Academy: בועת הגיבוי וההדר
ok(/state\(\) === 'boot'/.test(fn(lib, 'backupPill')), 'Academy: בועת הגיבוי לא מציגה "כבוי" בזמן הבדיקה');
ok(/img\.decoding = 'sync'/.test(fn(shell, 'createShell')), 'ההדר: הלוגו מפוענח מיד (עובר בין הדפים)');

// ---- הגרף: מחירי רשימת המעקב נשמרים, ציור ראשון מהמטמון
ok(/S\.wq = Object\.assign\(\{\}, S\.wq, j\.data/.test(chart), 'הגרף: בקשה חלקית לא מוחקת את מחירי רשימת המעקב');
ok(/kcqSeed\(\)/.test(fn(chart, 'openChart')) && /E\.qcache/.test(chart) && /qcache:/.test(app), 'הגרף: הציור הראשון מהמחירים האחרונים (דרך env)');
ok(/'pwa_kcq_v1'/.test(app.match(/const LS_CACHE_PREFIXES = \[[^\]]*\]/)[0]), 'pwa_kcq_v1 ברשימת המטמונים');

console.log('---- ' + n + ' בדיקות עברו');
