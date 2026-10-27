// 27/10/2026: ההתקדמות המשוערת של השלב בשרתון (ibkr-proxy/lib/studioprog.js — התראות השלב בווילון כשהאפליקציה סגורה)
// = הפס בטלפון (progressModel ב־studionet.js). שינוי באחד בלי השני — הבדיקה נכשלת.
// הרצה: node tests/studio-shade.test.js
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const PG = require(path.join(root, 'ibkr-proxy/lib/studioprog.js'));

(async () => {
  const net = await import(path.join(root, 'studionet.js'));
  ok(PG.STAGES.join() === net.STAGES.join(), 'אותם שלבים בשרתון ובטלפון');
  // מחולל פשוט וקבוע (בלי Math.random — אותה בדיקה בכל הרצה)
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const ST = ['tr', 'al', 'tl', 'rv', 'bn', 'sv'];
  let cmp = 0, worst = 0;
  for (let i = 0; i < 400; i++) {
    const now = 1e12;
    const ci = Math.floor(rnd() * ST.length), cur = ST[ci];
    const s = {}; for (const k of ST) s[k] = Math.round(30 + rnd() * 1500);
    const ep = { s, q: rnd() < 0.3 ? [0, 0.295, 0.449] : [0, +(rnd() * 0.5).toFixed(3), +(rnd() * 0.9).toFixed(3)] };
    const stg = {};
    let t = now - Math.round(rnd() * 4000e3);
    for (let k = 0; k < ci; k++) { const d = Math.round(rnd() * 2000e3); stg[ST[k]] = { s: t - d, e: t }; }
    stg[cur] = { s: now - Math.round(rnd() * 3000e3), e: 0 };
    const prog = { st: cur, p: rnd() < 0.5 ? 0 : +(rnd()).toFixed(3), stg, at: now - Math.round(rnd() * 120e3) };
    if (rnd() < 0.2) prog.eta = Math.round(rnd() * 900);
    const job = { state: 'running', prog, ep };
    const mine = PG.stageNow(job, now);
    const row = net.progressModel(job, ep.s, { done: true }, now, ep.q).stages.find((r) => r.state === 'now');
    if (!mine || !row) { ok(false, 'שורה "now" חסרה (' + cur + ')'); }
    worst = Math.max(worst, Math.abs(mine.p - row.pv));
    cmp++;
  }
  ok(cmp === 400 && worst < 1e-12, 'השרתון = הטלפון ב־400 מצבים אקראיים (הפרש מרבי ' + worst + ')');

  const now = 1e12, ep = { s: { tr: 100, al: 100, tl: 600, rv: 600, bn: 100, sv: 30 }, q: [0, 0.295, 0.449] };
  ok(PG.stageNow({ prog: { st: 'up', stg: { up: { s: now - 5e3 } } }, ep }, now) === null, 'העלאה — אין התראה מהשרתון (ל־Chrome יש התראה משלו)');
  ok(PG.stageNow({ prog: { st: 'rv', stg: { rv: { s: now - 5e3, e: now } } }, ep }, now) === null, 'שלב שנסגר — אין הערכה');
  ok(PG.stageNow({ prog: { st: 'rv', stg: { rv: { s: now - 5e3 } } } }, now) === null, 'בלי תוכנית (ep) — אין הערכה');
  const a = PG.stageNow({ prog: { st: 'rv', p: 0, stg: { rv: { s: now - 60e3 } } }, ep }, now);
  const b = PG.stageNow({ prog: { st: 'rv', p: 0, stg: { rv: { s: now - 300e3 } } }, ep }, now);
  ok(a.st === 'rv' && a.p > 0 && b.p > a.p && b.p < 0.99, 'בלי דיווח מהעובד הפס זוחל לפי הזמן (' + a.p.toFixed(2) + ' → ' + b.p.toFixed(2) + ')');
  ok(PG.shadeDue(null, { st: 'rv', p: 0 }) && !PG.shadeDue({ st: 'rv', b: 3 }, { st: 'rv', p: 0.35 }) && PG.shadeDue({ st: 'rv', b: 3 }, { st: 'rv', p: 0.41 })
    && PG.shadeDue({ st: 'tl', b: 9 }, { st: 'rv', p: 0 }) && !PG.shadeDue(null, { st: 'zz', p: 0.5 }), 'התראה: שלב חדש או עשירייה חדשה');
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
