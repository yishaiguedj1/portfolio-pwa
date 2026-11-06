// ldb.test.js — 5/11/2026: שלב 3 בתוכנית העצמאות מ־Firebase — מסד הנתונים שלנו (ibkr-proxy/lib/ldb.js, ldbsync.js, ldbchg.js).
// 1. התרגום ל־Firestore REST: מסמך, מסכות, תנאים, שאילתות, ספירה, commit, עמודים.
// 2. הסנכרון: ייבוא בתקציב, העותק במנות (_mt), האיחוד מול Vercel ("השינוי האחרון גובר"), תמונת מצב ושחזור.
// 3. היומן של Vercel (snbChg) והחיבורים: server.js, gauth, server-provision, compose, Dockerfile, הכללים.
// 4. הזרימות האמיתיות של הסטודיו (בדיקות קיימות) רצות שוב כשכל Firestore של השרתון הוא המסד שלנו (tests/_ldbwrap.js).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

let sqliteOk = true;
try { require('node:sqlite'); } catch (e) { sqliteOk = false; }
ok(sqliteOk, 'node:sqlite זמין (Node 22.13 ומעלה — כמו השרת וה־CI)');

const L = require(root + '/ibkr-proxy/lib/ldb.js');
const C = require(root + '/ibkr-proxy/lib/ldbchg.js');
const LS = require(root + '/ibkr-proxy/lib/ldbsync.js');
const FSM = require(root + '/ibkr-proxy/lib/fsmeter.js');

const P = 'p1';
const BASE = 'https://firestore.googleapis.com/v1/projects/' + P + '/databases/(default)/documents';
const sv = (s) => ({ stringValue: s }), iv = (x) => ({ integerValue: String(x) });

(async () => {
  // ---------------------------------------------------------------- 1. התרגום
  let clock = 1_800_000_000_000;
  const now = () => clock;
  const st = L.createStore({ project: P, now });
  const H = (m, u, b) => st.handle(m, BASE + u, b);
  ok(H('GET', '/studioJobs/a') === null, 'אוסף שעוד לא יובא — ממשיך ל־Firestore');
  st.setCol('studioJobs', { st: 'ready' }); st.setCol('sysCfg', { st: 'ready' }); st.setCol('users', { st: 'ready' });
  ok(H('GET', '/users/u1') === null && H('GET', '/academyUsers/u1') === null, 'האוספים של הטלפון (users, academyUsers) לעולם לא אצלנו');
  ok(st.handle('GET', BASE.replace(P, 'other') + '/studioJobs/a') === null, 'פרויקט אחר — ל־Firestore');
  let r = H('GET', '/studioJobs/a');
  ok(r.status === 404 && r.j.error.status === 'NOT_FOUND', 'GET למסמך שאין — 404 כמו Firestore');
  r = H('PATCH', '/studioJobs/a?updateMask.fieldPaths=uid&updateMask.fieldPaths=st&updateMask.fieldPaths=gone', { fields: { uid: sv('U1'), st: sv('q'), x: sv('לא במסכה') } });
  ok(r.status === 200 && r.j.fields.uid.stringValue === 'U1' && !r.j.fields.x && !r.j.fields.gone && /Z$/.test(r.j.updateTime) && r.j.name.endsWith('/studioJobs/a'), 'PATCH עם מסכה — רק השדות שבמסכה, התשובה כמו Firestore');
  const ut1 = r.j.updateTime;
  r = H('PATCH', '/studioJobs/a?updateMask.fieldPaths=st&updateMask.fieldPaths=uid', { fields: { st: sv('run') } });
  ok(r.j.fields.st.stringValue === 'run' && !r.j.fields.uid, 'שדה במסכה בלי ערך בגוף — נמחק');
  ok(r.j.updateTime > ut1 && r.j.createTime === ut1, 'updateTime עולה, createTime נשמר');
  r = H('PATCH', '/studioJobs/a?updateMask.fieldPaths=st&currentDocument.updateTime=' + encodeURIComponent(ut1), { fields: { st: sv('x') } });
  ok(r.status === 400 && r.j.error.status === 'FAILED_PRECONDITION', 'כתיבה בתנאי עם updateTime ישן — 400 (patchIf מחזיר false)');
  const ut2 = H('GET', '/studioJobs/a').j.updateTime;
  r = H('PATCH', '/studioJobs/a?updateMask.fieldPaths=st&currentDocument.updateTime=' + encodeURIComponent(ut2), { fields: { st: sv('done') } });
  ok(r.status === 200 && r.j.fields.st.stringValue === 'done', 'כתיבה בתנאי עם updateTime נוכחי — עוברת');
  r = H('PATCH', '/studioJobs/a?currentDocument.exists=false', { fields: { st: sv('q') } });
  ok(r.status === 409, 'currentDocument.exists=false על מסמך קיים — 409');
  r = H('PATCH', '/studioJobs/b?updateMask.fieldPaths=m.k&updateMask.fieldPaths=m.j', { fields: { m: { mapValue: { fields: { k: iv(1) } } } } });
  ok(r.j.fields.m.mapValue.fields.k.integerValue === '1', 'מסכה עם נתיב מקונן (m.k)');
  r = H('PATCH', '/studioJobs/b', { fields: { only: sv('1') } });
  ok(Object.keys(r.j.fields).join() === 'only', 'PATCH בלי מסכה — המסמך מוחלף');
  r = H('GET', '/studioJobs/a?mask.fieldPaths=st');
  ok(Object.keys(r.j.fields).join() === 'st', 'GET עם mask.fieldPaths');
  ok(H('DELETE', '/studioJobs/b').status === 200 && H('GET', '/studioJobs/b').status === 404 && H('DELETE', '/studioJobs/b').status === 200, 'DELETE (גם למסמך שאין — 200)');
  ok(st.rec('studioJobs', 'b').del === 1 && st.rec('studioJobs', 'b').dirty === 1, 'מחיקה = מצבה שמחכה לעותק');

  // שאילתות
  for (let i = 0; i < 6; i++) H('PATCH', '/studioJobs/j' + i, { fields: { uid: sv(i % 2 ? 'U1' : 'U2'), created: iv(100 + i), updated: iv(200 - i), tag: { arrayValue: { values: [sv('t' + (i % 3))] } } } });
  H('PATCH', '/studioJobs/s1', { fields: { uid: sv('U1'), created: sv('לא מספר') } });
  const q = (sq) => H('POST', ':runQuery', { structuredQuery: Object.assign({ from: [{ collectionId: 'studioJobs' }] }, sq) });
  const ids = (res) => res.j.filter((x) => x.document).map((x) => x.document.name.split('/').pop());
  r = q({ where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: sv('U1') } }, limit: 300 });
  ok(ids(r).join() === 'j1,j3,j5,s1' && r.reads === 4, 'שאילתת שוויון — לפי שם המסמך, עלות = מספר המסמכים');
  r = q({ where: { fieldFilter: { field: { fieldPath: 'created' }, op: 'GREATER_THAN_OR_EQUAL', value: iv(102) } }, orderBy: [{ field: { fieldPath: 'created' }, direction: 'DESCENDING' }], limit: 3 });
  ok(ids(r).join() === 'j5,j4,j3', 'טווח + orderBy יורד + limit; מחרוזת לא נכנסת לטווח של מספרים');
  r = q({ where: { compositeFilter: { op: 'AND', filters: [{ fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: sv('U2') } }, { fieldFilter: { field: { fieldPath: 'updated' }, op: 'LESS_THAN', value: iv(199) } }] } } });
  ok(ids(r).join() === 'j4,j2', 'AND עם אי־שוויון — מיון משתמע לפי שדה אי־השוויון');
  r = q({ where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: sv('אין') } } });
  ok(r.j.length === 1 && r.j[0].readTime && !r.j[0].document && r.reads === 1, 'שאילתה ריקה — [{readTime}], עלות 1');
  r = q({ where: { fieldFilter: { field: { fieldPath: 'tag' }, op: 'ARRAY_CONTAINS', value: sv('t1') } }, select: { fields: [{ fieldPath: 'uid' }] } });
  ok(ids(r).join() === 'j1,j4' && Object.keys(r.j[0].document.fields).join() === 'uid', 'ARRAY_CONTAINS + select');
  r = q({ where: { fieldFilter: { field: { fieldPath: 'created' }, op: 'IN', value: { arrayValue: { values: [iv(101), { doubleValue: 103 }] } } } } });
  ok(ids(r).join() === 'j1,j3', 'IN, ומספר שלם שווה ל־double');
  r = q({ orderBy: [{ field: { fieldPath: 'created' } }], offset: 1, limit: 2 });
  ok(ids(r).join() === 'j1,j2', 'orderBy בלי סינון: מסמך בלי השדה לא נכלל; offset');
  r = H('POST', ':runAggregationQuery', { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: 'studioJobs' }] }, aggregations: [{ alias: 'n', count: {} }] } });
  ok(r.j[0].result.aggregateFields.n.integerValue === '8', 'ספירה (aggregation count)');
  const st0 = st.stats.pass;
  ok(q({ startAt: { values: [iv(1)] } }) === null && st.stats.pass === st0 + 1 && st.stats.passWhy['sq:startAt'] === 1, 'צורה שלא נתמכת — ל־Firestore, ונספרת');
  ok(H('POST', ':runQuery', { structuredQuery: { from: [{ collectionId: 'users' }] } }) === null, 'שאילתה על users — ל־Firestore');

  // רשימה בעמודים
  let all = [], pt = '';
  for (let i = 0; i < 10; i++) { r = H('GET', '/studioJobs?pageSize=3' + (pt ? '&pageToken=' + encodeURIComponent(pt) : '')); all.push(...(r.j.documents || []).map((d) => d.name.split('/').pop())); pt = r.j.nextPageToken || ''; if (!pt) break; }
  ok(all.join() === 'a,j0,j1,j2,j3,j4,j5,s1', 'GET אוסף בעמודים (pageSize/pageToken) — כל המסמכים, בלי מחוקים');

  // commit
  const nm = (c, id) => 'projects/' + P + '/databases/(default)/documents/' + c + '/' + id;
  r = H('POST', ':commit', { writes: [{ transform: { document: nm('sysCfg', 'fnl'), fieldTransforms: [{ fieldPath: 'a', increment: iv(2) }, { fieldPath: 'b', increment: iv(1) }] } }] });
  r = H('POST', ':commit', { writes: [{ transform: { document: nm('sysCfg', 'fnl'), fieldTransforms: [{ fieldPath: 'a', increment: iv(3) }] } }] });
  ok(r.status === 200 && r.j.writeResults[0].transformResults[0].integerValue === '5' && H('GET', '/sysCfg/fnl').j.fields.b.integerValue === '1', 'commit: increment (גם על מסמך שאין)');
  r = H('POST', ':commit', { writes: [
    { update: { name: nm('sysCfg', 'x'), fields: { a: sv('1') } }, updateMask: { fieldPaths: ['a'] }, updateTransforms: [{ fieldPath: 'arr', appendMissingElements: { values: [sv('k'), sv('k')] } }, { fieldPath: 'mx', maximum: iv(4) }] },
    { delete: nm('sysCfg', 'fnl') }] });
  const x = H('GET', '/sysCfg/x').j.fields;
  ok(r.status === 200 && x.arr.arrayValue.values.length === 1 && x.mx.integerValue === '4' && H('GET', '/sysCfg/fnl').status === 404, 'commit: update + updateTransforms (append, maximum) + delete');
  r = H('POST', ':commit', { writes: [{ update: { name: nm('sysCfg', 'x'), fields: {} }, currentDocument: { exists: false } }] });
  ok(r.status === 409 && H('GET', '/sysCfg/x').j.fields.a, 'commit עם תנאי שנכשל — כלום לא נכתב');
  ok(H('POST', ':commit', { writes: [{ update: { name: nm('sysCfg', 'y'), fields: {} } }, { update: { name: nm('users', 'u'), fields: {} } }] }) === null, 'commit שנוגע גם ב־users — כולו ל־Firestore');

  // התמדה: פתיחה מחדש של אותו קובץ
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snb-ldb-'));
  const s1 = L.createStore({ file: path.join(tmp, 'a.db'), project: P, now });
  s1.setCol('studioOps', { st: 'ready' });
  s1.handle('PATCH', BASE + '/studioOps/o1', { fields: { v: sv('1') } });
  s1.kv('k', { a: 1 }); s1.close();
  const s2 = L.createStore({ file: path.join(tmp, 'a.db'), project: P, now });
  ok(s2.handle('GET', BASE + '/studioOps/o1', null).j.fields.v.stringValue === '1' && s2.kv('k').a === 1 && s2.rec('studioOps', 'o1').dirty === 1, 'אחרי הפעלה מחדש — המסמכים, המצב והתור של העותק נשארו');
  s2.close();

  // ---------------------------------------------------------------- 2. הסנכרון מול Firestore מדומה (אותו מנוע, כל האוספים)
  const remote = L.createStore({ project: P, now, all: true });
  const R = (m, u, b) => remote.handle(m, BASE + u, b);
  for (let i = 0; i < 7; i++) R('PATCH', '/studioJobs/r' + i, { fields: { uid: sv('U'), n: iv(i) } });
  R('PATCH', '/sysCfg/main', { fields: { mt: { booleanValue: false } } });
  R('PATCH', '/users/u1', { fields: { pf: sv('תיק') } });
  let calls = [];
  const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
  const remoteFetch = async (url, init = {}) => {
    const method = (init.method || 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push(method + ' ' + url.replace(BASE, ''));
    if (url.endsWith(':listCollectionIds')) return J({ collectionIds: [...remote._mem.keys()].filter((c) => [...remote._mem.get(c).values()].some((d) => !d.del)) });
    if (url.endsWith(':batchWrite')) {
      const status = body.writes.map((w) => { const x = remote.handle('POST', BASE + ':commit', { writes: [w] }); return x.status === 200 ? {} : { code: x.status === 400 ? 9 : x.status === 404 ? 5 : 6 }; });
      return J({ writeResults: body.writes.map(() => ({})), status });
    }
    const x = remote.handle(method, url, body);
    return x ? J(x.j, x.status) : J({ error: { code: 400 } }, 400);
  };
  const r2 = new Map();
  const io = { put: async (k, b) => { r2.set(k, Buffer.from(b)); return true; }, get: async (k) => r2.get(k) || null };
  const key = crypto.randomBytes(32);
  const dir = path.join(tmp, 'data');
  const blocker = path.join(tmp, 'a-file'); fs.writeFileSync(blocker, '');   // תיקייה שאי אפשר ליצור (ENOTDIR)
  const mk = (d) => LS.create({ own: () => true, fetch: remoteFetch, env: {}, project: P, dir: d, now, token: async () => 'T', r2: io, key, timers: false });
  const ctl = mk(dir);
  ok(await ctl.start() === true && ctl.status().on, 'נדלק כשיש תיקייה כתיבה');
  ok((await LS.create({ own: () => true, fetch: remoteFetch, env: { SNB_LDB: 'off' }, project: P, dir, timers: false }).start()) === false, 'SNB_LDB=off — כבוי');
  ok((await LS.create({ own: () => true, fetch: remoteFetch, env: {}, project: P, dir: path.join(blocker, 'data'), timers: false }).start()) === false, 'בלי תיקייה כתיבה ובלי R2 — כבוי, הכל כמו קודם');
  ok((await LS.create({ own: () => true, fetch: remoteFetch, env: { SNB_LDB_MEM: 'off' }, project: P, dir: path.join(blocker, 'data'), r2: io, key, timers: false }).start()) === false, 'SNB_LDB_MEM=off — בלי נפח נשאר כבוי');
  const F = ctl.wrapFetch(remoteFetch);
  const get = async (u) => { const res = await F(BASE + u); return { status: res.status, j: await res.json() }; };
  calls = [];
  ok((await get('/studioJobs/r1')).j.fields.n.integerValue === '1' && calls.length === 1, 'לפני הייבוא — הקריאה מגיעה ל־Firestore');
  // כתיבה שעוברת ל־Firestore בזמן הייבוא — נכנסת גם למסד
  await F(BASE + '/studioJobs/r9?updateMask.fieldPaths=n', { method: 'PATCH', body: JSON.stringify({ fields: { n: iv(9) } }) });
  ok(remote.get('studioJobs', 'r9') && ctl.store.get('studioJobs', 'r9').f.n.integerValue === '9', 'כתיבה בזמן הייבוא: ל־Firestore, ותשובתה גם למסד');
  for (let i = 0; i < 20 && ctl.status().imp.length + (ctl.store.kv('colsListed') ? 0 : 1) > 0; i++) await ctl.importTick();
  ok(ctl.status().ready >= 2 && ctl.store.ready('studioJobs') && ctl.store.ready('sysCfg') && !ctl.store.cols.has('users'), 'הייבוא: כל האוספים של השרתון, בלי users');
  ok(ctl.store.get('studioJobs', 'r6') && ctl.store.info().docs === 9, 'הייבוא הביא את כל המסמכים (בעמודים של 300)');
  calls = [];
  const before = FSM.view().loc;
  ok((await get('/studioJobs/r1')).j.fields.n.integerValue === '1' && calls.length === 0, 'אחרי הייבוא — הקריאה מהמסד שלנו, בלי Firestore');
  ok(FSM.view().loc === before + 1, 'הקריאה המקומית נספרת ב־fr.loc (לא במכסה)');
  ok((await get('/users/u1')).j.fields.pf && calls.length === 1, 'users — עדיין Firestore');
  // כתיבה מקומית → העותק
  clock += 1000;
  await F(BASE + '/studioJobs/r1?updateMask.fieldPaths=st', { method: 'PATCH', body: JSON.stringify({ fields: { st: sv('done') } }) });
  await F(BASE + '/studioJobs/r2', { method: 'DELETE' });
  ok(!remote.get('studioJobs', 'r1').f.st && ctl.status().q === 2, 'כתיבה מקומית — עוד לא ב־Firestore (בתור)');
  calls = [];
  await ctl.mirror();
  const rr1 = remote.get('studioJobs', 'r1');
  ok(calls.length === 1 && calls[0] === 'POST :batchWrite' && rr1.f.st.stringValue === 'done' && rr1.f.n.integerValue === '1' && +rr1.f._mt.integerValue === clock, 'העותק: מנה אחת, המסמך המלא + _mt');
  ok(!remote.get('studioJobs', 'r2') && ctl.status().q === 0, 'מחיקה הגיעה לעותק, והתור התרוקן');
  ok(!ctl.store.get('studioJobs', 'r1').f._mt, '_mt לא חוזר למסד שלנו');
  calls = [];
  await ctl.mirror();
  ok(calls.length === 0, 'אין שינויים — אין כתיבה');

  // האיחוד: Vercel כותב ישר ל־Firestore (עם היומן)
  const V = C.stampFetch(remoteFetch, now);
  const vpatch = (u, fields) => V(BASE + u, { method: 'PATCH', headers: { Authorization: 'Bearer V' }, body: JSON.stringify({ fields }) });
  clock += 1000;
  await vpatch('/studioJobs/r3?updateMask.fieldPaths=st', { st: sv('vercel') });
  const chg = remote.get('snbChg', 'studioJobs~r3');
  ok(chg && chg.f.c.stringValue === 'studioJobs' && chg.f.i.stringValue === 'r3' && +chg.f.t.integerValue === clock && chg.f.m.arrayValue.values[0].stringValue === 'st', 'Vercel: כתיבה מוצלחת נרשמת ביומן snbChg (אוסף, מזהה, זמן, שדות)');
  await vpatch('/users/u1?updateMask.fieldPaths=pf', { pf: sv('x') });
  ok(!remote.get('snbChg', 'users~u1'), 'Vercel: כתיבה ל־users לא נרשמת');
  await ctl.merge();
  ok(ctl.store.get('studioJobs', 'r3').f.st.stringValue === 'vercel' && ctl.store.get('studioJobs', 'r3').dirty === 0, 'איחוד: מסמך שלא השתנה אצלנו — מקבל את הגרסה של Vercel');
  ok(!remote.get('snbChg', 'studioJobs~r3'), 'איחוד: הרשומה ביומן נמחקה');
  // שלנו אחרון
  clock += 1000;
  await vpatch('/studioJobs/r4?updateMask.fieldPaths=st', { st: sv('vercel') });
  clock += 1000;
  await F(BASE + '/studioJobs/r4?updateMask.fieldPaths=st', { method: 'PATCH', body: JSON.stringify({ fields: { st: sv('ours') } }) });
  await ctl.merge(); await ctl.mirror();
  ok(ctl.store.get('studioJobs', 'r4').f.st.stringValue === 'ours' && remote.get('studioJobs', 'r4').f.st.stringValue === 'ours', 'שלנו אחרון — שלנו נשאר, והעותק דורס');
  // Vercel אחרון, ושלנו עוד לא נשלח — השדות של Vercel נכנסים, שלנו נשמרים
  clock += 1000;
  await F(BASE + '/studioJobs/r5?updateMask.fieldPaths=a', { method: 'PATCH', body: JSON.stringify({ fields: { a: sv('ours') } }) });
  clock += 1000;
  await vpatch('/studioJobs/r5?updateMask.fieldPaths=b', { b: sv('vercel') });
  await ctl.merge();
  const l5 = ctl.store.get('studioJobs', 'r5');
  ok(l5.f.a.stringValue === 'ours' && l5.f.b.stringValue === 'vercel' && l5.f.n.integerValue === '5' && l5.dirty === 1, 'Vercel אחרון ושלנו בתור — איחוד שדות (שלנו + של Vercel)');
  await ctl.mirror();
  ok(remote.get('studioJobs', 'r5').f.a.stringValue === 'ours' && remote.get('studioJobs', 'r5').f.b.stringValue === 'vercel', 'העותק אחרי האיחוד — שני השינויים');
  // מחיקה ב־Vercel
  clock += 1000;
  await V(BASE + '/studioJobs/r6', { method: 'DELETE', headers: { Authorization: 'Bearer V' } });
  await ctl.merge();
  ok(!ctl.store.get('studioJobs', 'r6') && ctl.store.rec('studioJobs', 'r6').del === 1, 'מחיקה ב־Vercel — נמחק גם אצלנו');
  // commit של Vercel עם טרנספורם
  clock += 1000;
  await V(BASE + ':commit', { method: 'POST', headers: { Authorization: 'Bearer V' }, body: JSON.stringify({ writes: [{ transform: { document: nm('sysCfg', 'cnt'), fieldTransforms: [{ fieldPath: 'k', increment: iv(1) }] } }] }) });
  await ctl.merge();
  ok(ctl.store.get('sysCfg', 'cnt').f.k.integerValue === '1', 'commit של Vercel (increment) — נקלט');
  ok(ctl.status().merge.n >= 5 && !ctl.status().merge.err, 'מצב האיחוד ב־status');
  // תקלה בעותק — המתנה, והתור נשמר
  let failW = true;
  const flaky = async (url, init) => (failW && url.endsWith(':batchWrite') ? J({ error: { code: 429 } }, 429) : remoteFetch(url, init));
  const ctlF = LS.create({ own: () => true, fetch: flaky, env: {}, project: P, dir: path.join(tmp, 'f'), now, token: async () => 'T', timers: false });
  await ctlF.start(); ctlF.store.setCol('studioOps', { st: 'ready' });
  await ctlF.wrapFetch(flaky)(BASE + '/studioOps/z', { method: 'PATCH', body: JSON.stringify({ fields: { v: sv('1') } }) });
  await ctlF.mirror();
  ok(ctlF.status().q === 1 && ctlF.status().mirror.err === 'http_429', 'מכסה נגמרה / תקלה — המסמך נשאר בתור, שום דבר לא נופל');
  failW = false; await ctlF.mirror();
  ok(ctlF.status().q === 1, 'אחרי תקלה — מחכים (backoff) ולא מנסים מיד');
  clock += 20 * 60e3; await ctlF.mirror();
  ok(ctlF.status().q === 0 && remote.get('studioOps', 'z'), 'אחרי ההמתנה — נשלח');

  // תמונת מצב ושחזור
  await ctl.snapshot(true);
  const blob = r2.get('ldb/' + P + '/snap.bin');
  ok(blob && !blob.includes(Buffer.from('studioJobs')) && ctl.status().snap.at, 'תמונת מצב ל־R2 — מוצפנת (שמות האוספים לא גלויים)');
  ok(LS.openSnap(crypto.randomBytes(32), blob) === null, 'מפתח אחר — לא נפתח');
  // אחרי התמונה: כתיבה מקומית שנשלחה לעותק — תחזור בשחזור דרך _mt
  clock += 60e3;
  await F(BASE + '/studioJobs/after?updateMask.fieldPaths=v', { method: 'PATCH', body: JSON.stringify({ fields: { v: sv('אחרי התמונה') } }) });
  await ctl.mirror();
  ctl.stop();
  const ctl2 = mk(path.join(tmp, 'new-server'));
  ok(await ctl2.start() === true && /^\d{4}-/.test(ctl2.status().restored || ''), 'שרת חדש (נפח ריק) — משחזר מתמונת המצב');
  ok(ctl2.store.get('studioJobs', 'r5').f.b.stringValue === 'vercel' && ctl2.store.ready('studioJobs'), 'אחרי השחזור — המסמכים והמצב של האוספים');
  ok(ctl2.store.get('studioJobs', 'after') && ctl2.store.get('studioJobs', 'after').f.v.stringValue === 'אחרי התמונה', 'מה שנשלח לעותק אחרי התמונה — הושלם מ־Firestore (_mt)');
  ctl2.stop();

  // מצב זיכרון: אין נפח /data (שרת שהנפח לא הותקן בו) — המסד בזיכרון, ותמונת המצב ב־R2 היא ההתמדה
  const noDir = path.join(blocker, 'data');
  const mkMem = () => LS.create({ own: () => true, fetch: remoteFetch, env: {}, project: P, dir: noDir, now, token: async () => 'T', r2: io, key, timers: false });
  const m1 = mkMem();
  ok(await m1.start() === true && m1.status().mode === 'mem' && /^\d{4}-/.test(m1.status().restored || ''), 'בלי נפח ועם R2 — נדלק בזיכרון ומשחזר מתמונת המצב');
  ok(m1.store.get('studioJobs', 'r5').f.b.stringValue === 'vercel' && m1.store.ready('studioJobs'), 'מצב זיכרון — המסמכים והאוספים המוכנים');
  clock += 60e3;
  await m1.wrapFetch(remoteFetch)(BASE + '/studioJobs/mem1?updateMask.fieldPaths=v', { method: 'PATCH', body: JSON.stringify({ fields: { v: sv('בזיכרון') } }) });
  await m1.flush();
  ok(m1.status().q === 0 && remote.get('studioJobs', 'mem1'), 'כיבוי מסודר — העותק נשלח');
  ok(m1.status().snap.at === new Date(clock).toISOString() && !m1.status().snap.err, 'כיבוי מסודר — תמונת מצב סופית ל־R2');
  m1.stop();
  remote._mem.get('studioJobs').delete('mem1');   // גם אם העותק לא היה מגיע — התמונה לבדה מספיקה
  const m2 = mkMem();
  ok(await m2.start() === true && m2.store.get('studioJobs', 'mem1') && m2.store.get('studioJobs', 'mem1').f.v.stringValue === 'בזיכרון', 'הפעלה מחדש (פריסה) — מה שנכתב בזיכרון חזר מהתמונה');
  m2.stop();
  const badIo = { put: io.put, get: async () => { throw new Error('r2_down'); } };
  const m3 = LS.create({ own: () => true, fetch: remoteFetch, env: {}, project: P, dir: noDir, now, token: async () => 'T', r2: badIo, key, timers: false });
  ok(await m3.start() === false && m3.status().why === 'restore_err', 'R2 לא זמין בעלייה — לא עולים ריק (תמונה ריקה הייתה דורסת את הטובה)');
  ok(!r2.get('ldb/' + P + '/snap.bin').equals(Buffer.alloc(0)), 'התמונה ב־R2 נשארה');

  // אבטחה: המסד עונה רק לבקשה עם טוקן שהתהליך הנפיק. בלי — ממשיכה ל־Firestore (שבודק אותה), ולא נלמדת
  let passed = 0;
  const spy = async (url, init) => { passed++; return remoteFetch(url, init); };
  const ca = LS.create({ own: (t) => t === 'OWN', fetch: spy, env: {}, project: P, dir: path.join(tmp, 'auth'), now, token: async () => 'T', timers: false });
  await ca.start(); ca.store.setCol('studioJobs', { st: 'ready' });
  ca.store.putRemote('studioJobs', 'sec', { name: 'x', fields: { s: sv('סוד') } });
  const FA = ca.wrapFetch(spy);
  passed = 0; await FA(BASE + '/studioJobs/sec');
  ok(passed === 1 && ca.store.stats.passWhy.auth === 1, 'בלי טוקן — לא נענה מהמסד, ממשיך ל־Firestore (שם נדחה כמו תמיד)');
  passed = 0; await FA(BASE + '/studioJobs/sec', { headers: { Authorization: 'Bearer זר' } });
  ok(passed === 1 && ca.store.stats.passWhy.auth === 2, 'טוקן שלא אנחנו הנפקנו — ממשיך ל־Firestore');
  passed = 0; const ra = await FA(BASE + '/studioJobs/sec', { headers: { Authorization: 'Bearer OWN' } });
  ok(passed === 0 && ra.status === 200, 'טוקן שלנו — נענה מהמסד');
  passed = 0; await FA(BASE + '/studioJobs/w1', { method: 'PATCH', headers: { Authorization: 'Bearer זר' }, body: JSON.stringify({ fields: { v: sv('x') } }) });
  ok(passed === 1 && !ca.store.get('studioJobs', 'w1'), 'כתיבה עם טוקן זר — לא נכנסת למסד (גם לא דרך הלמידה)');
  ca.stop();
  const G = require('../ibkr-proxy/lib/gauth');
  ok(G.ownToken('') === false && G.ownToken('לא-שלנו') === false && G.ownToken(null) === false, 'gauth.ownToken — רק טוקן שהתהליך הנפיק');
  if (process.platform !== 'win32') ok((fs.statSync(path.join(tmp, 'auth', 'snb.db')).mode & 0o077) === 0, 'קובץ המסד — רק לבעלים (600)');
  const ev = LS.create({ own: () => true, fetch: remoteFetch, env: {}, project: P, dir: path.join(tmp, 'ev'), now, token: async () => 'T', timers: false });
  await ev.start();
  ev.store.load({ cols: [['users', 'ready'], ['studioX', 'ready']], kv: [], docs: [['users', 'u1', { a: sv('1') }, null, null, 0, 0, 0, 0], ['studioX', 'a/b', { a: sv('1') }, null, null, 0, 0, 0, 0], ['studioX', 'ok', { a: sv('1') }, null, null, 0, 0, 0, 0]] });
  ok(!ev.store.get('users', 'u1') && !ev.store.ready('users') && !ev.store.get('studioX', 'a/b') && ev.store.get('studioX', 'ok'), 'שחזור — רק אוספים של השרתון ומזהים תקינים (הגנה לעומק)');
  ev.stop();
  ok(/const errOf = /.test(read('ibkr-proxy/lib/ldbsync.js')) && !/e\.message \|\| e\)\.slice/.test(read('ibkr-proxy/lib/ldbsync.js')), 'הסטטוס הציבורי — שגיאות רק כקוד קצר (errOf), בלי הודעות גולמיות');

  // ---------------------------------------------------------------- 3. היומן והחיבורים
  ok(C.changesOf('PATCH', BASE + '/studioJobs/a?updateMask.fieldPaths=a.b', null).list[0].m[0] === 'a.b' && C.topField('a.b') === 'a' && C.topField('`x-y`.z') === 'x-y', 'changesOf / topField');
  ok(C.changesOf('PATCH', BASE + '/snbChg/a', null).list.length === 0 && C.changesOf('GET', BASE + '/studioJobs/a', null).list.length === 0, 'היומן עצמו ו־GET לא נרשמים');
  ok(C.changesOf('PATCH', BASE + '/studioJobs/a', null).list[0].full === true, 'PATCH בלי מסכה = נכתב כולו (f)');
  const g0 = globalThis.fetch;
  ok(C.installOnVercel({}) === false && globalThis.fetch === g0, 'בלי VERCEL — היומן לא מותקן (השרת שלנו)');
  ok(C.installOnVercel({ VERCEL: '1', SNB_LDB_CHG: 'off' }) === false, 'SNB_LDB_CHG=off — כבוי');
  ok(/require\('\.\/ldbchg'\)\.installOnVercel\(\)/.test(read('ibkr-proxy/lib/gauth.js')), 'gauth.js מתקין את היומן (נטען בכל פונקציה של Vercel שניגשת ל־Firestore)');

  // האוספים של הטלפון = מה שהכללים פותחים
  const rules = read('firestore/firestore.rules');
  const open = [...rules.matchAll(/match \/([A-Za-z]+)\/\{/g)].map((m) => m[1]).filter((c) => c !== 'databases').sort();
  ok(open.join() === [...C.CLIENT].sort().join(), 'CLIENT (נשארים ב־Firestore) = האוספים שהכללים פותחים לטלפון: ' + open.join());

  const srv = read('ibkr-proxy/server.js');
  ok(/const inner = FSM\.wrapFetch\(globalThis\.fetch\)/.test(srv) && /globalThis\.fetch = LDB\.wrapFetch\(inner\)/.test(srv), 'server.js: המסד לפני המונה — קריאה מקומית לא נספרת במכסה');
  ok(/LDB\.flush\(\)/.test(srv), 'server.js: בכיבוי — העותק נשלח');
  ok(/ldb: require\('\.\/ldbsync'\)\.status\(\)/.test(read('ibkr-proxy/lib/session.js')), 'GET /api/session → ldb');
  const prov = read('tools/server-provision.js');
  ok((prov.match(/await chg\(env, tok, sid, (true|false), deps\)/g) || []).length === 2 && prov.includes('CH.chgWrite('), 'server-provision: רישום/הסרה של שרת נרשמים ביומן (השרת שלנו קורא studioServers מהמסד)');
  const comp = read('infra/compose.yaml');
  const svc = (name) => { const i = comp.indexOf('\n  ' + name + ':\n'), m = /\n  [a-z-]+:\n/g; m.lastIndex = i + 3; const nx = m.exec(comp); return comp.slice(i, nx ? nx.index : comp.length); };
  ok(/- appdb:\/data/.test(svc('app')) && /- appdb-stg:\/data/.test(svc('app-stg')), 'compose: נפח קבוע /data לשרתון של הייצור ושל הניסוי');
  ok(/^  appdb: \{\}/m.test(comp) && /^  appdb-stg: \{\}/m.test(comp), 'compose: הנפחים מוגדרים');
  ok(/mkdir -p \/data && chown 10001:10001 \/data/.test(read('infra/app/Dockerfile')), 'Dockerfile: /data שייך למשתמש של השרתון (הנפח מקבל את הבעלות)');
  ok(/node-version: 22/.test(read('.github/workflows/test.yml').split('node-tests:')[1].split('steps:')[1].slice(0, 400)), 'ה־CI של בדיקות node — Node 22');

  // ---------------------------------------------------------------- 4. הזרימות האמיתיות מול המסד שלנו
  const SUITES = ['studio-r2-flow', 'studio-phone', 'studio-url', 'studio-relay', 'studio-pt', 'studio-nu', 'studio-fsreads', 'sysflags', 'devlog', 'learn-ux', 'yt-server'];
  for (const t of SUITES) {
    const p = spawnSync(process.execPath, ['-r', './_ldbwrap.js', t + '.test.js'], { cwd: __dirname, env: Object.assign({}, process.env, { LDB_STATS: '1' }), encoding: 'utf8', timeout: 140e3 });
    const m = /\[ldb\] loc=(\d+) pass=(\d+)/.exec(p.stderr || '');
    ok(p.status === 0 && m && +m[1] > 0 && m[2] === '0', t + ' — עוברת כשהשרתון עובד מול המסד שלנו (' + (m ? m[1] : '?') + ' בקשות, 0 ל־Firestore)'
      + (p.status === 0 ? '' : '\n' + String(p.stdout).split('\n').filter((l) => /FAIL|Error/.test(l)).slice(0, 3).join('\n')));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('כל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error('FAIL -', e && e.stack || e); process.exit(1); });
