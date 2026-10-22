// 22/10/2026: מסך ההפקה מחדש — המצב האמיתי (בתור / מתחילים / מורידים / צורבים / שומרים) עם אחוז וזמן שנשאר,
// ובעובד — הפס של rerender.py לא חוזר לאפס בכל מעבר (RenderProg לפי המעברים שנבחרו)
const fs = require('fs'), path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
(async () => {
  const st = await import(path.join(root, 'studio.js'));
  const now = 1e12;
  ok(st.rrNow({ state: 'queued' }, now).k === 'wait' && st.rrNow({ state: 'new' }, now).k === 'wait', 'בתור / חדשה — ממתין');
  ok(st.rrNow({ state: 'running', prog: {} }, now).k === 'start', 'נלקחה ועוד לא דיווחה — "מתחילים", לא "צורבים"');
  ok(st.rrNow({ state: 'running', prog: { st: 'up', p: 0.4 } }, now).k === 'up', 'מורידים את הסרטון');
  const b = st.rrNow({ state: 'running', prog: { st: 'bn', p: 0.25, stg: { bn: { s: now - 300e3 } } } }, now);
  ok(b.k === 'bn' && b.p === 0.25 && Math.round(b.left) === 900, 'צורבים: 25% אחרי 5 דק׳ → נשארו כ־15 דק׳');
  ok(st.rrNow({ state: 'running', prog: { st: 'bn', p: 0.02, stg: { bn: { s: now - 300e3 } } } }, now).left === null, 'פחות מ־3% — בלי צפי (קופץ)');
  ok(st.rrNow({ state: 'running', prog: { st: 'bn', p: 0.5, stg: { bn: { s: now - 10e3 } } } }, now).left === null, 'פחות מ־20 שנ׳ בשלב — בלי צפי');
  const sj = read('studio.js'), ap = read('app.js');
  ok(/const n = rrNow\(r\.srv, Date\.now\(\)\)/.test(sj), 'pageRr משתמש ב־rrNow');
  ok(ap.includes('studioRrStStart: "מתחילים"') && ap.includes('studioRrStStart: "Starting"'), 'מחרוזת "מתחילים" בשתי השפות');
  const jp = read('translator/job.py');
  ok(/prog=RenderProg\(rr_render_flags\(want\)\)/.test(jp), 'העובד: ההפקה מחדש מדווחת לפי המעברים (RenderProg)');
  console.log(n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
