// _ldbwrap.js — 5/11/2026 (שלב 3 בתוכנית העצמאות מ־Firebase): נטען לפני בדיקה קיימת (node -r ./_ldbwrap.js x.test.js) ומנתב כל
// בקשה ל־Firestore של api/studio.js למסד שלנו (lib/ldb.js), בזיכרון. כך הזרימות האמיתיות של הסטודיו (תור, עבודות, טלפון, R2…)
// רצות מול התרגום שלנו ל־Firestore REST, וכל אוסף של השרתון "מוכן" מההתחלה. מי שעוד מגיע ל־Firestore המדומה — רק מה שלא נתמך
// (נספר ב־globalThis.__ldb.stats.pass) והאוספים של הטלפון (users, academyUsers). tests/ldb.test.js מריץ כך כמה בדיקות.
const Module = require('module');
const path = require('path');
const root = path.join(__dirname, '..');
const L = require(root + '/ibkr-proxy/lib/ldb.js');
const C = require(root + '/ibkr-proxy/lib/ldbchg.js');
const store = L.createStore({ project: process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e' });
globalThis.__ldb = store;
const readyAll = (u, body) => {
  const cs = [];
  if (u.path.length) cs.push(u.path[0]);
  const sq = body && (body.structuredQuery || (body.structuredAggregationQuery && body.structuredAggregationQuery.structuredQuery));
  if (sq && sq.from) for (const f of sq.from) cs.push(f.collectionId);
  if (body && Array.isArray(body.writes)) for (const w of body.writes) { const nm = C.parseName(w.delete || (w.update && w.update.name) || (w.transform && w.transform.document)); if (nm) cs.push(nm.col); }
  for (const c of cs) if (C.serverCol(c) && !store.ready(c)) store.setCol(c, { st: 'ready' });
};
// הבדיקות מכינות מסמכים ישירות ב־Map של Firestore המדומה (db.set('studioJobs/x', {fields})). אצלנו זה "הייבוא": כל set/delete
// כזה (שלא בא מהכתיבה הכפולה שלנו) נכנס גם למסד, כאילו נקרא מ־Firestore
let fwd = 0, seq = 0;
const TYPED = /^(nullValue|booleanValue|integerValue|doubleValue|timestampValue|stringValue|bytesValue|referenceValue|geoPointValue|arrayValue|mapValue)$/;
const fieldsOf = (v) => {
  if (!v || typeof v !== 'object') return null;
  if (v.fields && typeof v.fields === 'object') return v.fields;
  const ks = Object.keys(v);
  return ks.length && ks.every((k) => v[k] && typeof v[k] === 'object' && Object.keys(v[k]).length === 1 && TYPED.test(Object.keys(v[k])[0])) ? v : null;
};
const KEY = /^(?:.*\/documents\/)?([A-Za-z][A-Za-z0-9_]*)\/([^/]+)$/;
const mset = Map.prototype.set, mdel = Map.prototype.delete;
const seen = new Map();   // מפתח → { f (האובייקט במדומה), j } — בדיקה שמשנה אותו במקום (Object.assign(doc(), …)) נקלטת בסריקה
const put = (c, id, f) => { store.setCol(c, { st: 'ready' }); store.putRemote(c, id, { fields: f, updateTime: L.utOf(Date.now() * 1000 + (++seq)) }); };
Map.prototype.set = function (k, v) {
  if (typeof k === 'string') { const m = KEY.exec(k), f = m && C.serverCol(m[1]) && fieldsOf(v);
    if (f) { mset.call(seen, m[1] + '/' + m[2], { f, j: JSON.stringify(f) }); if (!fwd) put(m[1], m[2], f); } }
  return mset.call(this, k, v);
};
const scan = () => { for (const [k, x] of seen) { const j = JSON.stringify(x.f); if (j !== x.j) { x.j = j; const i = k.indexOf('/'); put(k.slice(0, i), k.slice(i + 1), JSON.parse(j)); } } };
Map.prototype.delete = function (k) {
  if (typeof k === 'string') { const m = KEY.exec(k); if (m) mdel.call(seen, m[1] + '/' + m[2]); if (!fwd && m && C.serverCol(m[1]) && store.rec(m[1], m[2])) store.putTomb(m[1], m[2]); }
  return mdel.call(this, k);
};
const wrap = (f) => async (input, init) => {
  const url = String(typeof input === 'string' ? input : (input && input.url) || '');
  const u = C.parseUrl(url);
  if (u && u.project === store.project) {
    const method = String((init && init.method) || 'GET').toUpperCase();
    let body = null;
    if (init && typeof init.body === 'string') { try { body = JSON.parse(init.body); } catch (e) {} }
    readyAll(u, body);
    scan();
    const r = store.handle(method, url, body);
    if (r) {
      // כתיבה מוצלחת — גם ל־Firestore המדומה (הבדיקה בודקת שם ישירות), בלי תנאי הגרסה (ה־updateTime שלנו לא שלו)
      if (method !== 'GET' && r.status === 200 && !/:run(Aggregation)?Query$/.test(url.split('?')[0])) {
        const q = url.indexOf('?') >= 0 ? new URLSearchParams(url.slice(url.indexOf('?') + 1)) : null;
        if (q) { q.delete('currentDocument.updateTime'); q.delete('currentDocument.exists'); }
        const u2 = q ? url.slice(0, url.indexOf('?')) + (String(q) ? '?' + String(q) : '') : url;
        let b2 = init && init.body;
        if (body && Array.isArray(body.writes)) b2 = JSON.stringify({ writes: body.writes.map((w) => { const x = Object.assign({}, w); delete x.currentDocument; return x; }) });
        fwd++;
        try { await f(u2, Object.assign({}, init, { body: b2 })); } catch (e) {} finally { fwd--; }
      }
      return new Response(JSON.stringify(r.j), { status: r.status, headers: { 'content-type': 'application/json' } });
    }
  }
  return f(input, init);
};
const orig = Module._load;
Module._load = function (req, parent, isMain) {
  const m = orig.apply(this, arguments);
  try {
    const file = Module._resolveFilename(req, parent, isMain);
    if (file === path.join(root, 'ibkr-proxy/api/studio.js') && m && m._handler && !m._handler._ldb) {
      const h = m._handler;
      m._handler = function (req2, res, deps = {}) { return h(req2, res, Object.assign({}, deps, { fetch: wrap(deps.fetch || globalThis.fetch) })); };
      m._handler._ldb = true;
    }
  } catch (e) {}
  return m;
};
if (process.env.LDB_STATS) process.on('exit', () => { const s = store.stats; console.error('[ldb] loc=' + s.loc + ' pass=' + s.pass + ' ' + JSON.stringify(s.passWhy)); });
