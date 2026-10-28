// 28/10/2026: מכסת Firestore נגמרה שוב (06:32 בבוקר, "השרתון לא ענה" בסטודיו). כאן:
// (1) מונה הקריאות לפי פעולה (ibkr-proxy/lib/fsmeter.js) — סופר כמו החיוב, מתייג לפי הפעולה, ומוצג ב־GET /api/session.
// (2) בבית של הסטודיו, בזמן עבודה רצה, הריענון לא קורא את כל רשימת העבודות בכל פעם (op:'jobs' = קריאה לכל עבודה).
// (3) מכסה (fs_http_429) מוצגת כמכסה עם שעת החזרה — לא "השרתון לא ענה".
// הרצה: node tests/fsmeter.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const FSM = require(path.join(root, 'ibkr-proxy/lib/fsmeter.js'));

(async () => {
  FSM._reset();
  const R = (status, body) => ({ status, clone() { return { json: async () => body }; } });
  const base = 'https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents';
  const fake = async (url) => {
    if (url.endsWith(':runQuery')) return R(200, [{ document: { name: 'a' } }, { document: { name: 'b' } }, { document: { name: 'c' } }]);
    if (url.includes('/quota')) return R(429, { error: {} });
    if (url.includes('/col?')) return R(200, { documents: [{}, {}] });
    return R(200, { fields: {} });
  };
  const f = FSM.wrapFetch(fake);
  ok(FSM.wrapFetch(f) === f, 'עטיפה כפולה — אותה פונקציה');
  const now = Date.now();
  await FSM.run('studio:jobs', () => f(base + ':runQuery', { method: 'POST' }));
  await FSM.run('studio:jobs', () => f(base + ':runQuery', { method: 'POST' }));
  await FSM.run('studio:job', () => f(base + '/studioJobs/x'));
  await FSM.run('ibkr-sync:px', () => f(base + '/col?pageSize=300'));
  await FSM.run('studio:status', () => f(base + '/quota/x'));
  await FSM.run('studio:status', () => f('https://example.com/x'));
  await FSM.run('studio:report', () => f(base + '/studioJobs/x?updateMask.fieldPaths=a', { method: 'PATCH' }));
  await new Promise((r) => setTimeout(r, 20));
  const v = FSM.view(now);
  const m = Object.fromEntries(v.top);
  ok(m['studio:jobs'] === 6, 'שאילתה = מספר המסמכים שחזרו (2 × 3)');
  ok(m['studio:job'] === 1, 'מסמך = קריאה אחת');
  ok(m['ibkr-sync:px'] === 2, 'רשימת אוסף = מספר המסמכים');
  ok(!m['studio:status'], '429 ובקשה שאינה Firestore — לא נספרות');
  ok(!m['studio:report'], 'כתיבה (PATCH) — לא קריאה');
  ok(v.total === 9 && v.top[0][0] === 'studio:jobs', 'הסכום, והצרכן הגדול ראשון');
  ok(FSM.view(now + 2 * 86400e3).total === 0, 'יום מכסה חדש — מתחיל מאפס');
  ok(FSM.tagOf('studio', { method: 'POST', body: { op: 'jobs<x>' } }) === 'studio:jobsx', 'התווית — רק תווים בטוחים');
  ok(FSM.tagOf('ibkr-sync', { method: 'GET', query: { job: 'px' } }) === 'ibkr-sync:px', 'קרון — לפי job');

  // GET /api/session מציג את הפילוח
  const sess = require(path.join(root, 'ibkr-proxy/lib/session.js'));
  const h = typeof sess === 'function' ? sess : sess.default || sess.handler;
  let out = null;
  const res = { headers: {}, setHeader() {}, status(c) { this.c = c; return this; }, json(o) { out = o; return this; }, end() { return this; } };
  await h({ method: 'GET', headers: {}, query: {} }, res);
  ok(out && out.fr && Array.isArray(out.fr.top), 'GET /api/session מחזיר fr');

  const srv = fs.readFileSync(path.join(root, 'ibkr-proxy/server.js'), 'utf8');
  ok(/globalThis\.fetch = FSM\.wrapFetch\(globalThis\.fetch\)/.test(srv) && /FSM\.run\(FSM\.tagOf\(name, req\)/.test(srv), 'server.js — העטיפה והתיוג מחוברים');

  // הסטודיו: הבית בזמן עבודה רצה — op:'job' לעבודות הרצות, הרשימה המלאה רק פעם ב־JOBS_FULL_MS
  const st = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
  const fm = /const JOBS_FULL_MS = (\d+) \* 60e3/.exec(st);
  ok(fm && +fm[1] >= 5, 'JOBS_FULL_MS — לפחות 5 דקות');
  const home = st.slice(st.indexOf("} else if (ui.view === 'home') {", st.indexOf('async function pollNow')), st.indexOf("else if (ui.view === 'server') await refreshServers();", st.indexOf('async function pollNow')));
  ok(/net\.api\('job'/.test(home) && /JOBS_FULL_MS/.test(home), 'pollNow בבית — עבודה בודדת, לא כל הרשימה בכל טיק');
  const sp = /else if \(ui\.view === 'home'\) ms = [^;]*\? (\d+) :/.exec(st);
  ok(sp && +sp[1] >= 15000, 'קצב הריענון בבית — לא מתחת ל־15 שנ׳');
  ok(/j\.error === 'fs_http_429' \? 'quota'/.test(st) && /studioErrQuota/.test(st), 'מכסה — הודעה משלה');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  ok((app.match(/studioErrQuota: "[^"]*\{t\}[^"]*"/g) || []).length === 2, 'studioErrQuota בעברית ובאנגלית, עם השעה');

  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
