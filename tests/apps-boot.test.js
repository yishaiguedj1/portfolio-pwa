// בנייה 409 (13/10/2026): האתחול המשותף של Academy ו־Studio (appBoot ב־shell.js) — כמו ב־app.js של Invest.
// עד 408 הדפים העצמאיים רק רשמו את ה־SW: בלי בדיקת עדכון בחזרה מהרקע, בלי רענון כשגרסה חדשה משתלטת
// (בטלפון Academy התחלף כחול ← ירוק ← כחול בין עותק ישן לחדש), ובלי הפס "סביבת ניסוי".
// כאן appBoot רץ ב־vm עם navigator/document מדומים.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const shell = read('shell.js');

const src = (shell.match(/export function appBoot\(\) \{[\s\S]*?\n\}/) || [])[0];
ok(!!src, 'shell.js מייצא appBoot');
const hSrc = (shell.match(/const h = \(tag, cls, txt\) => .*;/) || [])[0];

function run({ env = 'staging', controller = true, busy = false } = {}) {
  const docL = {}, swL = {}, made = [], log = { reload: 0, update: 0, registered: 0 };
  const body = { prepend: (e) => made.push(e) };
  const document = {
    body, hidden: false,
    querySelector: (s) => (s === '.env-strip' ? made.find((e) => e.className === 'env-strip') || null : null),
    createElement: (tag) => ({ tag, className: '', textContent: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }),
    addEventListener: (k, f) => { (docL[k] = docL[k] || []).push(f); },
  };
  const reg = { update: () => { log.update++; return Promise.resolve(); } };
  const navigator = { serviceWorker: {
    controller: controller ? {} : null,
    addEventListener: (k, f) => { (swL[k] = swL[k] || []).push(f); },
    register: (u) => { log.registered++; log.url = u; return Promise.resolve(reg); },
  } };
  const timers = [];
  const ctx = {
    window: { SNB_ENV: { name: env }, snbStudioBusy: () => busy },
    document, navigator,
    location: { protocol: 'https:', reload: () => { log.reload++; } },
    t: (k) => (k === 'envStaging' ? 'סביבת ניסוי' : k),
    setTimeout: (f) => { timers.push(f); },
  };
  vm.createContext(ctx);
  vm.runInContext(hSrc + '\n' + src.replace('export ', '') + '\nappBoot();', ctx);
  return { made, log, docL, swL, timers, ctx, setBusy: (b) => { ctx.window.snbStudioBusy = () => b; } };
}

(async () => {
  let r = run();
  await new Promise((res) => setImmediate(res));
  ok(r.made.length === 1 && r.made[0].className === 'env-strip' && r.made[0].textContent === 'סביבת ניסוי' && r.made[0].attrs.role === 'note', 'בסביבת הניסוי — הפס "סביבת ניסוי" (כמו ב־Invest)');
  ok(r.log.registered === 1 && r.log.url === 'sw.js' && r.log.update === 1, 'רישום ה־SW + בדיקת עדכון בפתיחה');
  r.docL.visibilitychange.forEach((f) => f());
  ok(r.log.update === 2, 'חזרה מהרקע — בדיקת עדכון נוספת (מעבר ממסך הבית לא טוען את הדף)');
  r.swL.controllerchange.forEach((f) => f());
  ok(r.log.reload === 1, 'גרסה חדשה השתלטה — רענון אוטומטי (עותק ישן לא נשאר פתוח)');
  r.swL.controllerchange.forEach((f) => f());
  ok(r.log.reload === 1, 'רענון אחד בלבד (בלי לולאה)');

  r = run({ env: 'prod' });
  ok(r.made.length === 0, 'בייצור — בלי הפס');

  r = run({ controller: false });
  r.swL.controllerchange.forEach((f) => f());
  ok(r.log.reload === 0, 'התקנה ראשונה (בלי SW קודם) — בלי רענון');

  r = run({ busy: true });
  r.swL.controllerchange.forEach((f) => f());
  ok(r.log.reload === 0 && r.timers.length === 1, 'באמצע העלאה בסטודיו — לא מרעננים, מחכים');
  r.setBusy(false); r.timers.shift()();
  ok(r.log.reload === 1, 'ההעלאה הסתיימה — מרעננים');

  for (const f of ['academy-app.js', 'studio-app.js']) {
    const s = read(f);
    ok(/import \{[^}]*\bappBoot\b[^}]*\} from '\.\/shell\.js'/.test(s) && /^appBoot\(\);/m.test(s) && !/serviceWorker\.register/.test(s), f + ': האתחול דרך appBoot, בלי רישום SW משלו');
  }
  for (const f of ['strings-academy.js', 'strings-studio.js']) ok(/"envStaging"/.test(read(f)), f + ': המחרוזת envStaging (coregen)');
  console.log(`\n${n} בדיקות עברו`);
})();
