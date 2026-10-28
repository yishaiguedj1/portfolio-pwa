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

  // (4) ההתראה המוקדמת (בקשת המשתמש 28/10): פעולה מעל TAG_HOUR בשעה, או קצב שיגמור 70% מהמכסה
  FSM._reset();
  const t0 = Date.UTC(2026, 9, 28, 17, 0, 0);   // 10:00 בקליפורניה — 14 שעות עד האיפוס
  await FSM.run('studio:job', async () => { for (let i = 0; i < 30; i++) FSM.add(10, t0 + i * 60e3); });   // 300 בחצי שעה — רגיל
  ok(FSM.alarms(t0 + 30 * 60e3).length === 0, 'קצב רגיל — בלי התראה');
  await FSM.run('studio:jobs', async () => { for (let i = 0; i < 30; i++) FSM.add(72, t0 + i * 60e3); });   // 2,160 בחצי שעה = הבאג של הבוקר
  const al = FSM.alarms(t0 + 30 * 60e3);
  ok(al.length === 2 && al[0].k === 'tag' && al[0].tag === 'studio:jobs' && al[0].h === 2160, 'הבאג של הבוקר — התראה על הפעולה, בתוך חצי שעה');
  ok(al[1].k === 'pace' && al[1].proj > 35000, 'וגם התראת קצב (צפי מעל 70% מהמכסה)');
  ok(FSM.alarms(t0 + 40 * 60e3).length === 0, 'אותה התראה — פעם אחת ביום');
  const fv = FSM.view(t0 + 30 * 60e3);
  ok(fv.hot.includes('studio:jobs') && !fv.hot.includes('studio:job') && fv.top[0][2] === 2160, 'view — מסומן חריג, עם השעה האחרונה');
  ok(FSM.view(t0 + 200 * 60e3).h === 0, 'אחרי יותר משעה בלי קריאות — 0 בשעה האחרונה');

  // נוסח ההתראה
  const W = require(path.join(root, 'ibkr-proxy/lib/webpush.js'));
  ok(W.KINDS.includes('fs_hot') && W.TEXT.he.fs_hot && W.TEXT.en.fs_hot, 'fs_hot — סוג התראה, בעברית ובאנגלית');
  const m1 = W.message('fs_hot', '', 'he', al[0]);
  ok(m1 && m1.t === 'קריאות חריגות למסד הנתונים' && m1.b.includes('studio:jobs') && m1.b.includes('2,160') && /#mon$/.test(m1.u), 'ההתראה — איזו פעולה, כמה, ונפתחת בניטור השרתים');
  const m2 = W.message('fs_hot', '', 'en', al[1]);
  ok(m2 && /quota will run out/.test(m2.t), 'התראת הקצב — באנגלית');
  ok(W.message('fs_hot', '', 'he', { k: 'tag', tag: 'a<script>', h: 1 }).b.indexOf('<') < 0, 'התווית מסוננת');

  // הבודק בשרתון (?fsw=1): התראה למנהל דרך notify; בלי ממצא — בלי Firestore
  const studio = require(path.join(root, 'ibkr-proxy/api/studio.js'));
  let fsCalls = 0;
  const deps = { now: t0 + 31 * 60e3, fetch: async (url) => { if (String(url).includes('firestore')) fsCalls++; return { status: 404, ok: false, json: async () => ({}), text: async () => '', headers: { get: () => null } }; } };
  let o2 = null;
  const res2 = { headers: {}, setHeader() {}, status(c) { this.c = c; return this; }, json(o) { o2 = o; return this; }, end() { return this; } };
  delete process.env.STUDIO_WATCH_SECRET; delete process.env.VERCEL;
  await studio._handler({ method: 'GET', headers: {}, query: { fsw: '1' } }, res2, deps);
  ok(o2 && o2.ok && o2.al === 0 && fsCalls === 0, '?fsw=1 בלי ממצא חדש — בלי קריאה ל־Firestore');
  process.env.VERCEL = '1';
  await studio._handler({ method: 'GET', headers: {}, query: { fsw: '1' } }, res2, deps);
  ok(res2.c === 404, 'ב־Vercel — לא רץ');
  delete process.env.VERCEL;
  ok(/startFsWatch\(server\)/.test(srv) && /SNB_FSW/.test(srv), 'server.js — הבודק מופעל כל 5 דק׳');
  const adm = fs.readFileSync(path.join(root, 'admin-app.js'), 'utf8');
  ok(/fsSec\(D\.monFr\)/.test(adm) && (app.match(/admFsT: "[^"]+"/g) || []).length === 2, 'ניטור השרתים — מציג את הקריאות לפי פעולה');

  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
