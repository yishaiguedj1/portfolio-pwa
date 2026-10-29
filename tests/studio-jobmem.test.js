// 29/10/2026: התראת fs_hot — studio:jobs קרא 1,807 מסמכים בשעה. listJobs (op:'jobs' ועוד ~20 מקומות) קרא את *כל* העבודות
// של המשתמש בכל פנייה. עכשיו מטמון בזיכרון: רשימה מלאה פעם ב־JM_FULL_MS, ובין לבין רק מה שנכתב מאז (שדה mt).
// כאן: Firestore מדומה שסופר קריאות כמו החיוב, 150 עבודות, שעה של ריענון כל 30 שנ׳ עם עבודה רצה — ושהרשימה תמיד נכונה.
// הרצה: node tests/studio-jobmem.test.js
const path = require('path');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }

(async () => {
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.GDRIVE_SA_KEY = JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  let clock = Date.UTC(2026, 9, 29, 5, 0, 0);
  Date.now = () => clock;
  const studio = require(path.join(__dirname, '..', 'ibkr-proxy/api/studio.js'));
  studio._reset();
  const { listJobs, patchJob, delDoc, JM_FULL_MS } = studio._jobMem;

  const db = new Map();
  let reads = 0;
  const J = (o, st = 200) => ({ status: st, ok: st < 300, json: async () => o, text: async () => JSON.stringify(o), headers: { get: () => null } });
  const fetchMock = async (url, opt = {}) => {
    if (url.includes('oauth2.googleapis.com/token')) return J({ access_token: 'SA', expires_in: 3600 });
    if (url.endsWith('/documents:runQuery')) {
      const q = JSON.parse(opt.body).structuredQuery, f = q.where.fieldFilter, col = q.from[0].collectionId;
      const iv = (v, p) => +((v.fields[p] || {}).integerValue || 0);
      const pass = (v) => f.op === 'GREATER_THAN_OR_EQUAL' ? v.fields[f.field.fieldPath] && iv(v, f.field.fieldPath) >= +f.value.integerValue
        : v.fields[f.field.fieldPath] && v.fields[f.field.fieldPath].stringValue === f.value.stringValue;
      let hit = [...db.entries()].filter(([k, v]) => k.startsWith(col + '/') && pass(v));
      if (q.orderBy) hit.sort((a, b) => iv(b[1], 'mt') - iv(a[1], 'mt'));
      hit = hit.slice(0, q.limit || 50);
      reads += Math.max(1, hit.length);
      return J(hit.map(([k, v]) => ({ document: { name: 'projects/p/databases/(default)/documents/' + k, fields: v.fields } })).concat([{ readTime: 'x' }]));
    }
    const m = url.match(/\/documents\/([A-Za-z]+)\/([A-Za-z0-9_-]+)(?:\?(.*))?$/);
    const k = m[1] + '/' + m[2], cur = db.get(k);
    if (opt.method === 'DELETE') { db.delete(k); return J({}); }
    if (opt.method === 'PATCH') {
      const mask = new URLSearchParams(m[3] || '').getAll('updateMask.fieldPaths'), body = JSON.parse(opt.body).fields;
      db.set(k, { fields: Object.assign({}, cur ? cur.fields : {}, ...mask.map((x) => ({ [x]: body[x] }))) });
      return J({});
    }
    reads++;
    return cur ? J({ fields: cur.fields }) : J({}, 404);
  };
  const deps = { fetch: fetchMock, jobMem: true };
  const U = 'uidAAAAAAAAAAAAAAAAAAAAAAAA', V = 'uidBBBBBBBBBBBBBBBBBBBBBBBB';
  // 150 עבודות ישנות (בלי mt — נכתבו לפני התיקון) + 20 של משתמש אחר
  for (let i = 0; i < 170; i++) {
    const id = 'job' + String(i).padStart(17, '0');
    db.set('studioJobs/' + id, { fields: { uid: { stringValue: i < 150 ? U : V }, created: { integerValue: String(clock - 1e8 + i) }, state: { stringValue: 'done' } } });
  }
  const ids = (l) => l.map((j) => j.id + ':' + j.state + ':' + (j.pct || 0)).join(',');
  const fresh = async (uid) => ids(await listJobs({ fetch: fetchMock, jobMem: false }, uid));

  ok((await listJobs(deps, U)).length === 150, 'רשימה מלאה בפעם הראשונה');
  const live = 'job' + String(149).padStart(17, '0');
  await patchJob(deps, live, { state: 'running', pct: 1 });
  ok(db.get('studioJobs/' + live).fields.mt, 'כל כתיבה לעבודה מקבלת mt');

  /* שעה: ריענון של הבית כל 30 שנ׳ (op:'jobs'), העובד מדווח התקדמות כל 10 שנ׳ */
  reads = 0;
  let bad = 0;
  const T0 = clock;
  for (let t = 0; t < 3600e3; t += 5000) {
    clock = T0 + t;
    if (t % 10000 === 0) await patchJob(deps, live, { pct: Math.round(t / 36e3) });
    if (t % 30000 === 0) {
      const got = ids(await listJobs(deps, U)), r1 = reads;
      const want = await fresh(U); reads = r1;
      if (got !== want) bad++;
    }
  }
  console.log('  קריאות בשעה: ' + reads + ' (לפני התיקון: ' + 120 * 150 + ')');
  ok(bad === 0, 'הרשימה מהמטמון זהה תמיד לקריאה ישירה');
  ok(reads < 400, 'שעה של ריענון עם עבודה רצה — מתחת ל־400 קריאות (כולל רשימה מלאה פעם בחצי שעה)');

  /* קריאה בתוך ה־TTL בלי כתיבה — אפס קריאות */
  clock += 1000; await listJobs(deps, U); reads = 0; clock += 1000;
  await listJobs(deps, U);
  ok(reads === 0, 'בתוך ה־TTL בלי כתיבה — בלי קריאה');

  /* מחיקה, עבודה חדשה, מעבר בין משתמשים */
  const gone = 'job' + String(3).padStart(17, '0');
  await delDoc(deps, 'studioJobs', gone);
  ok(!(await listJobs(deps, U)).some((j) => j.id === gone), 'מחיקה — נעלמת מיד');
  await patchJob(deps, 'jobNEW0000000000000001', { uid: U, created: clock, state: 'new' });
  ok((await listJobs(deps, U)).some((j) => j.id === 'jobNEW0000000000000001'), 'עבודה חדשה — מופיעה מיד');
  ok((await listJobs(deps, V)).length === 20, 'משתמש שני — הרשימה שלו בלבד');
  await patchJob(deps, 'jobNEW0000000000000001', { uid: V });
  clock += 1000;
  ok(!(await listJobs(deps, U)).some((j) => j.id === 'jobNEW0000000000000001') && (await listJobs(deps, V)).some((j) => j.id === 'jobNEW0000000000000001'), 'עבודה שעברה משתמש — זזה');

  /* כתיבה מבחוץ בלי mt (מופע אחר / כלי) — נראית לכל המאוחר ברשימה המלאה הבאה */
  db.get('studioJobs/' + live).fields.state = { stringValue: 'failed' };
  clock += JM_FULL_MS + 1;
  ok((await listJobs(deps, U)).find((j) => j.id === live).state === 'failed', 'כתיבה בלי mt — נקלטת ברשימה המלאה הבאה');

  /* העותק שמוחזר לא משנה את המטמון */
  const l = await listJobs(deps, U); l[0].state = 'zzz';
  ok((await listJobs(deps, U))[0].state !== 'zzz', 'שינוי בתוצאה לא נוגע במטמון');

  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
