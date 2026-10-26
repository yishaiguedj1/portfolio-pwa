// 26/10/2026: מכסת הקריאות היומית של Firestore (50 אלף בתוכנית החינמית) נגמרה בבוקר — רק משרת התרגום הפנוי, שפונה לשרתון
// כל כמה שניות (pq כל 4 שנ׳, poll כל 20, ptNext, devMet). כאן: שעה של שרת פנוי בקצב של הסוכן האמיתי (translator/agent.py),
// סופרים קריאות של Firestore ומוודאים שיום שלם רחוק מהמכסה. וגם: האימות בזיכרון לא פותח דלת לטוקן שגוי / שרת שהוסר.
// הרצה: node tests/studio-fsreads.test.js
const path = require('path');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');

(async () => {
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, {
    GDRIVE_SA_KEY: JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
  });
  let clock = Date.UTC(2026, 9, 26, 3, 0, 0);
  const realNow = Date.now;
  Date.now = () => clock;   // המגביל (limited) והמטמונים לפי השעון המדומה
  const studio = require(path.join(root, 'ibkr-proxy/api/studio.js'));
  studio._reset();

  /* Firestore מדומה — סופר קריאות כמו החיוב: מסמך = 1, שאילתה = מספר המסמכים שחזרו (לפחות 1) */
  const db = new Map();
  let reads = 0, utSeq = 0;
  const J = (o, st = 200) => ({ status: st, ok: st < 300, json: async () => o, text: async () => JSON.stringify(o), headers: { get: () => null } });
  const fetchAll = async (url, opt = {}) => {
    if (url.includes('oauth2.googleapis.com/token')) return J({ access_token: 'SA', expires_in: 3600 });
    if (url.includes('api.github.com')) return J({ workflow_runs: [] });
    if (url.endsWith('/documents:runQuery')) {
      const q = JSON.parse(opt.body).structuredQuery, w = q.where, col = q.from[0].collectionId;
      const fl = !w ? [] : w.fieldFilter ? [w.fieldFilter] : w.compositeFilter.filters.map((f) => f.fieldFilter);
      const hit = [...db.entries()].filter(([k, v]) => k.startsWith(col + '/') && fl.every((f) => v.fields[f.field.fieldPath] && v.fields[f.field.fieldPath].stringValue === f.value.stringValue));
      reads += Math.max(1, hit.length);
      return J(hit.map(([k, v]) => ({ document: { name: 'projects/p/databases/(default)/documents/' + k, fields: v.fields, updateTime: v.ut } })).concat([{ readTime: 'x' }]));
    }
    const m = url.match(/\/documents\/([A-Za-z]+)\/([A-Za-z0-9_-]+)(?:\?(.*))?$/);
    if (!m) return J({}, 404);
    const k = m[1] + '/' + m[2], cur = db.get(k);
    if ((opt.method || 'GET') === 'GET') { reads++; return cur ? J({ fields: cur.fields, updateTime: cur.ut }) : J({}, 404); }
    if (opt.method === 'DELETE') { db.delete(k); return J({}); }
    if (opt.method === 'PATCH') {
      const qp = new URLSearchParams(m[3] || '');
      const mask = qp.getAll('updateMask.fieldPaths'), pre = qp.get('currentDocument.updateTime');
      if (pre && (!cur || cur.ut !== pre)) return J({}, 400);
      const body = JSON.parse(opt.body).fields;
      db.set(k, { fields: mask.length ? Object.assign({}, cur ? cur.fields : {}, ...mask.map((f) => ({ [f]: body[f] }))) : body, ut: 't' + (++utSeq) });
      return J({});
    }
    return J({}, 400);
  };
  const deps = () => ({ fetch: fetchAll, now: clock, workerRelease: () => null });

  const SID = 'srv000000001', STOK = SID + '-' + crypto.randomBytes(32).toString('base64url');
  db.set('studioServers/' + SID, { fields: { th: { stringValue: crypto.createHash('sha256').update(STOK).digest('hex') }, by: { stringValue: 'ownerUid0001' }, seen: { integerValue: String(clock) } }, ut: 't0' });
  const srv = async (b, tk) => {
    const res = { code: 0, j: null, setHeader() {}, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; } };
    await studio._handler({ method: 'POST', query: {}, body: b, headers: { authorization: 'Bearer ' + (tk || STOK) }, socket: { remoteAddress: '1.1.1.1' } }, res, deps());
    return res;
  };
  const HB = { v: 'dev', nj: 0, busy: 0 };

  /* ---------- 1. שעה של שרת פנוי, בקצב של agent.py ---------- */
  const T0 = clock, HOUR = 3600e3;
  let nPoll = 0, nPq = 0, fails = 0;
  const tickMs = 1000;
  for (let t = 0; t < HOUR; t += tickMs) {
    clock = T0 + t;
    if (t % 20000 === 0) { nPoll++; if ((await srv({ op: 'poll', hb: HB })).code !== 200) fails++; }   // POLL_S
    if (t % 4000 === 0) { nPq++; if ((await srv({ op: 'pq' })).code !== 200) fails++; }               // PQ_S
    if (t % 25000 === 0) await srv({ op: 'ptNext', have: [], max: 8, w: 25000 });                   // התור לא בתהליך הזה — no_hub
    if (t % 60000 === 0) await srv({ op: 'devMet', d: {} });                                         // MET_S
    if (t % 300000 === 0) await srv({ op: 'ytCk', v: 0 });                                           // YT_SYNC_S
  }
  ok(fails === 0, 'כל הפניות של השרת הפנוי ענו 200 (' + nPoll + ' poll, ' + nPq + ' pq)');
  const perDay = Math.round(reads * 24);
  console.log('  קריאות בשעה: ' + reads + ' → ביום: ' + perDay);
  ok(perDay < 20000, 'שרת פנוי — פחות מ־20 אלף קריאות ביום (מכסה: 50 אלף; לפני התיקון ~45 אלף)');

  /* ---------- 2. האימות בזיכרון לא פותח דלת ---------- */
  ok((await srv({ op: 'pq' }, SID + '-' + 'x'.repeat(43))).code === 401, 'טוקן שגוי לשרת שבזיכרון — 401');
  ok((await srv({ op: 'pq' }, 'srv000000002-' + 'y'.repeat(43))).code === 401, 'שרת שלא קיים — 401');
  db.delete('studioServers/' + SID);
  ok((await srv({ op: 'poll', hb: HB })).code === 401, 'שרת שהוסר — poll נדחה מיד (תמיד מול Firestore)');
  ok((await srv({ op: 'pq' })).code === 401, 'ואחרי ש־poll ראה שהוסר — גם הפעולות הקלות נדחות');

  /* ---------- 3. שרת שהטוקן שלו הוחלף: הקל נדחה לכל המאוחר אחרי SRV_AUTH_MS ---------- */
  const T2 = SID.replace('1', '3'), TK2 = T2 + '-' + crypto.randomBytes(32).toString('base64url');
  const put = (tk) => db.set('studioServers/' + T2, { fields: { th: { stringValue: crypto.createHash('sha256').update(tk).digest('hex') }, seen: { integerValue: String(clock) } }, ut: 't' + (++utSeq) });
  put(TK2);
  ok((await srv({ op: 'pq' }, TK2)).code === 200, 'שרת חדש — pq עובד');
  put(T2 + '-' + crypto.randomBytes(32).toString('base64url'));
  clock += 5 * 60e3 + 1;
  ok((await srv({ op: 'pq' }, TK2)).code === 401, 'טוקן שהוחלף — נדחה אחרי 5 דקות לכל המאוחר');

  Date.now = realNow;
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
