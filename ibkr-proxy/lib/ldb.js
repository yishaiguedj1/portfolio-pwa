'use strict';
/* 5/11/2026 — שלב 3 בתוכנית העצמאות מ־Firebase: מסד הנתונים שלנו על השרת (SQLite, node:sqlite — מובנה ב־Node 22, בלי תלויות).
   השכבה האחת לגישה לנתונים: השרתון ממשיך לדבר "Firestore REST" (fetch ל־firestore.googleapis.com), ו־server.js מנתב
   (lib/ldbsync.js → wrapFetch) כל בקשה לאוסף שרק השרתון ניגש אליו לכאן. כך אף אחד מעשרות המקומות שקוראים ל־Firestore
   (api/studio.js, lib/acmerge.js, lib/mailer.js, lib/session.js…) לא השתנה, והקריאות שלהם לא עולות קריאה במכסה.
   מה נתמך (כל מה שהשרתון משתמש בו — ומה שלא, ממשיך ל־Firestore כמו היום, וזה נספר ב־stats.pass):
     GET מסמך (mask.fieldPaths) · GET אוסף (pageSize/pageToken) · PATCH (updateMask, currentDocument.exists/updateTime)
     · DELETE · :runQuery (where: fieldFilter/compositeFilter/unaryFilter, orderBy, limit, offset, select)
     · :runAggregationQuery (count) · :commit (update/delete/transform: increment, maximum, minimum, REQUEST_TIME, מערכים).
   הזיכרון: כל המסמכים נטענים לזיכרון בפתיחה (Map לכל אוסף); SQLite הוא ההתמדה — כל כתיבה נשמרת בו מיד (WAL).
   כל כתיבה מקומית מסומנת dirty — lib/ldbsync.js שולח את המצב האחרון של כל מסמך כזה ל־Firestore במנות (העותק).
   מחיקה = מצבה (del=1) עד שהעותק התעדכן, כדי שהאיחוד לא יחזיר מסמך שנמחק. */
const C = require('./ldbchg');

const SCHEMA = [
  'PRAGMA journal_mode=WAL', 'PRAGMA synchronous=NORMAL', 'PRAGMA busy_timeout=3000',
  'CREATE TABLE IF NOT EXISTS docs (col TEXT NOT NULL, id TEXT NOT NULL, f TEXT, ct TEXT, ut TEXT, utu INTEGER, lw INTEGER, dirty INTEGER, del INTEGER, PRIMARY KEY (col, id)) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS cols (col TEXT PRIMARY KEY, st TEXT, pt TEXT, n INTEGER, at INTEGER)',
  'CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)',
];
const UNSUP = 'unsupported';
class Unsupported extends Error { constructor(w) { super(UNSUP + ':' + w); this.unsup = w; } }

/* ---------- זמנים: updateTime בפורמט של Firestore (מיקרו־שניות) ---------- */
function utOf(us) {
  return new Date(Math.floor(us / 1000)).toISOString().slice(0, 19) + '.' + String(us % 1e6).padStart(6, '0') + 'Z';
}
function parseUt(s) {
  const m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/.exec(String(s || ''));
  if (!m) return 0;
  return Date.parse(m[1] + 'Z') * 1000 + Number((m[2] || '').padEnd(6, '0').slice(0, 6));
}

/* ---------- ערכים (Value של Firestore) ---------- */
const TORD = { nullValue: 0, booleanValue: 1, integerValue: 2, doubleValue: 2, timestampValue: 3, stringValue: 4, bytesValue: 5, referenceValue: 6, geoPointValue: 7, arrayValue: 8, mapValue: 9 };
function vtype(v) { if (v && typeof v === 'object') for (const k in v) if (k in TORD) return k; return ''; }
const num = (v) => Number(v.integerValue != null ? v.integerValue : v.doubleValue);
const sgn = (x) => (x < 0 ? -1 : x > 0 ? 1 : 0);
/* הסדר של Firestore: null < bool < מספר < זמן < מחרוזת < bytes < הפניה < geo < מערך < map */
function vcmp(a, b) {
  const ta = vtype(a), tb = vtype(b);
  const oa = TORD[ta], ob = TORD[tb];
  if (oa !== ob) return sgn(oa - ob);
  switch (oa) {
    case 0: return 0;
    case 1: return sgn((a.booleanValue ? 1 : 0) - (b.booleanValue ? 1 : 0));
    case 2: { const x = num(a), y = num(b); if (Number.isNaN(x) || Number.isNaN(y)) return Number.isNaN(x) ? (Number.isNaN(y) ? 0 : -1) : 1; return sgn(x - y); }
    case 3: return sgn(parseUt(a.timestampValue) - parseUt(b.timestampValue));
    case 4: case 5: case 6: { const x = String(a[ta]), y = String(b[tb]); return x < y ? -1 : x > y ? 1 : 0; }
    case 7: { const x = a.geoPointValue || {}, y = b.geoPointValue || {}; return sgn((x.latitude || 0) - (y.latitude || 0)) || sgn((x.longitude || 0) - (y.longitude || 0)); }
    case 8: {
      const x = (a.arrayValue && a.arrayValue.values) || [], y = (b.arrayValue && b.arrayValue.values) || [];
      for (let i = 0; i < Math.min(x.length, y.length); i++) { const c = vcmp(x[i], y[i]); if (c) return c; }
      return sgn(x.length - y.length);
    }
    case 9: {
      const x = (a.mapValue && a.mapValue.fields) || {}, y = (b.mapValue && b.mapValue.fields) || {};
      const kx = Object.keys(x).sort(), ky = Object.keys(y).sort();
      for (let i = 0; i < Math.min(kx.length, ky.length); i++) {
        if (kx[i] !== ky[i]) return kx[i] < ky[i] ? -1 : 1;
        const c = vcmp(x[kx[i]], y[ky[i]]); if (c) return c;
      }
      return sgn(kx.length - ky.length);
    }
  }
  return 0;
}
const veq = (a, b) => vtype(a) !== '' && vcmp(a, b) === 0 && !(TORD[vtype(a)] === 2 && Number.isNaN(num(a)));

/* ---------- נתיבי שדות (a.b, `x-y`.z) ---------- */
function fpSegs(fp) {
  const s = String(fp || ''), out = [];
  let cur = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '\\' && i + 1 < s.length) cur += s[++i]; else if (ch === '`') q = false; else cur += ch; }
    else if (ch === '`') q = true;
    else if (ch === '.') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
function getPath(fields, segs) {
  let v = fields ? fields[segs[0]] : undefined;
  for (let i = 1; i < segs.length && v !== undefined; i++) v = v.mapValue && v.mapValue.fields ? v.mapValue.fields[segs[i]] : undefined;
  return v;
}
function setPath(fields, segs, val) {
  let o = fields;
  for (let i = 0; i < segs.length - 1; i++) {
    let v = o[segs[i]];
    if (!v || !v.mapValue) { v = { mapValue: { fields: {} } }; o[segs[i]] = v; }
    if (!v.mapValue.fields) v.mapValue.fields = {};
    o = v.mapValue.fields;
  }
  o[segs[segs.length - 1]] = val;
}
function delPath(fields, segs) {
  let o = fields;
  for (let i = 0; i < segs.length - 1; i++) {
    const v = o[segs[i]];
    if (!v || !v.mapValue || !v.mapValue.fields) return;
    o = v.mapValue.fields;
  }
  delete o[segs[segs.length - 1]];
}
function pick(fields, paths) {
  const out = {};
  for (const p of paths) { const s = fpSegs(p), v = getPath(fields, s); if (v !== undefined) setPath(out, s, clone(v)); }
  return out;
}
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));

/* ---------- סינון ומיון של שאילתה ---------- */
const RANGE = new Set(['LESS_THAN', 'LESS_THAN_OR_EQUAL', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL']);
const INEQ = new Set([...RANGE, 'NOT_EQUAL', 'NOT_IN']);
function fieldOf(d, fp) { return fp === '__name__' ? { referenceValue: d.name } : getPath(d.f, fpSegs(fp)); }
const isNull = (v) => vtype(v) === 'nullValue';
function evalFilter(flt, d) {
  if (!flt || typeof flt !== 'object') throw new Unsupported('filter');
  if (flt.compositeFilter) {
    const fs = flt.compositeFilter.filters || [];
    if (flt.compositeFilter.op === 'AND') return fs.every((x) => evalFilter(x, d));
    if (flt.compositeFilter.op === 'OR') return fs.some((x) => evalFilter(x, d));
    throw new Unsupported('composite');
  }
  if (flt.fieldFilter) {
    const ff = flt.fieldFilter, v = fieldOf(d, ff.field && ff.field.fieldPath), x = ff.value;
    if (v === undefined) return false;
    const arr = (y) => (y && y.arrayValue && y.arrayValue.values) || [];
    switch (ff.op) {
      case 'EQUAL': return veq(v, x);
      case 'NOT_EQUAL': return !isNull(v) && !veq(v, x);
      case 'LESS_THAN': return TORD[vtype(v)] === TORD[vtype(x)] && vcmp(v, x) < 0;
      case 'LESS_THAN_OR_EQUAL': return TORD[vtype(v)] === TORD[vtype(x)] && vcmp(v, x) <= 0;
      case 'GREATER_THAN': return TORD[vtype(v)] === TORD[vtype(x)] && vcmp(v, x) > 0;
      case 'GREATER_THAN_OR_EQUAL': return TORD[vtype(v)] === TORD[vtype(x)] && vcmp(v, x) >= 0;
      case 'ARRAY_CONTAINS': return arr(v).some((e) => veq(e, x));
      case 'ARRAY_CONTAINS_ANY': return arr(v).some((e) => arr(x).some((y) => veq(e, y)));
      case 'IN': return arr(x).some((y) => veq(v, y));
      case 'NOT_IN': return !isNull(v) && !arr(x).some((y) => veq(v, y));
    }
    throw new Unsupported('op');
  }
  if (flt.unaryFilter) {
    const u = flt.unaryFilter, v = fieldOf(d, u.field && u.field.fieldPath);
    const nan = v !== undefined && TORD[vtype(v)] === 2 && Number.isNaN(num(v));
    switch (u.op) {
      case 'IS_NULL': return v !== undefined && isNull(v);
      case 'IS_NOT_NULL': return v !== undefined && !isNull(v);
      case 'IS_NAN': return nan;
      case 'IS_NOT_NAN': return v !== undefined && !nan && TORD[vtype(v)] === 2;
    }
    throw new Unsupported('unary');
  }
  throw new Unsupported('filter');
}
function ineqFields(flt, out = []) {
  if (!flt) return out;
  if (flt.compositeFilter) for (const x of flt.compositeFilter.filters || []) ineqFields(x, out);
  else if (flt.fieldFilter && INEQ.has(flt.fieldFilter.op)) { const p = flt.fieldFilter.field.fieldPath; if (!out.includes(p)) out.push(p); }
  return out;
}
const SQ_KEYS = new Set(['from', 'where', 'orderBy', 'limit', 'offset', 'select']);
const intOf = (x) => (x == null ? null : typeof x === 'object' ? Number(x.value) : Number(x));

function createStore(o = {}) {
  const project = String(o.project || '');
  const nowMs = o.now || (() => Date.now());
  const sqlite = o.sqlite || require('node:sqlite');
  const db = new sqlite.DatabaseSync(o.file || ':memory:');
  for (const s of SCHEMA) db.exec(s);
  const st = {
    put: db.prepare('INSERT INTO docs (col, id, f, ct, ut, utu, lw, dirty, del) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(col, id) DO UPDATE SET f=excluded.f, ct=excluded.ct, ut=excluded.ut, utu=excluded.utu, lw=excluded.lw, dirty=excluded.dirty, del=excluded.del'),
    rm: db.prepare('DELETE FROM docs WHERE col = ? AND id = ?'),
    clean: db.prepare('UPDATE docs SET dirty = 0 WHERE col = ? AND id = ? AND lw = ?'),
    colPut: db.prepare('INSERT INTO cols (col, st, pt, n, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(col) DO UPDATE SET st=excluded.st, pt=excluded.pt, n=excluded.n, at=excluded.at'),
    kvGet: db.prepare('SELECT v FROM kv WHERE k = ?'),
    kvPut: db.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v'),
  };
  const mem = new Map();    // col → Map(id → rec { f, ct, ut, utu, lw, dirty, del })
  const cols = new Map();   // col → { st: 'imp'|'ready', pt, n, at }
  let bytes = 0, lastUs = 0;
  for (const r of db.prepare('SELECT col, st, pt, n, at FROM cols').all()) cols.set(r.col, { st: r.st, pt: r.pt || '', n: r.n || 0, at: r.at || 0 });
  for (const r of db.prepare('SELECT col, id, f, ct, ut, utu, lw, dirty, del FROM docs').iterate()) {
    let m = mem.get(r.col); if (!m) mem.set(r.col, (m = new Map()));
    m.set(r.id, { f: r.del ? null : JSON.parse(r.f || '{}'), ct: r.ct, ut: r.ut, utu: r.utu, lw: r.lw, dirty: r.dirty, del: r.del });
    bytes += (r.f || '').length;
  }
  const stats = { loc: 0, locReads: 0, pass: 0, passWhy: {}, w: 0, gen: 0 };   // gen — כל שינוי במסד (לתמונת המצב)

  const newUs = () => { lastUs = Math.max(nowMs() * 1000, lastUs + 1); return lastUs; };
  const colMap = (c) => { let m = mem.get(c); if (!m) mem.set(c, (m = new Map())); return m; };
  const live = (c, id) => { const r = mem.get(c) && mem.get(c).get(id); return r && !r.del ? r : null; };
  function persist(c, id, r) {
    st.put.run(c, id, r.del ? null : JSON.stringify(r.f), r.ct || null, r.ut || null, r.utu || 0, r.lw || 0, r.dirty ? 1 : 0, r.del ? 1 : 0);
    colMap(c).set(id, r);
    stats.gen++;
  }
  // o.all — כל אוסף (רק בבדיקות: Firestore מדומה שבנוי מאותו מנוע)
  const ready = (c) => (o.all ? /^[A-Za-z][A-Za-z0-9_]*$/.test(String(c || '')) : C.serverCol(c) && !!cols.get(c) && cols.get(c).st === 'ready');
  const nameOf = (c, id) => C.docName(project, c, id);
  function docJson(c, id, r, mask) {
    const f = mask && mask.length ? pick(r.f, mask) : r.f;
    const d = { name: nameOf(c, id) };
    if (f && Object.keys(f).length) d.fields = f;
    d.createTime = r.ct; d.updateTime = r.ut;
    return d;
  }
  const err = (code, status, message) => ({ status: code, j: { error: { code, message: message || status, status } } });

  /* כתיבה מקומית: מצב חדש (f) או מחיקה (null) — dirty לעותק */
  function writeLocal(c, id, f) {
    const old = colMap(c).get(id);
    const us = newUs(), ut = utOf(us);
    const r = f == null
      ? { f: null, ct: null, ut, utu: us, lw: nowMs(), dirty: 1, del: 1 }
      : { f, ct: old && !old.del ? old.ct : ut, ut, utu: us, lw: nowMs(), dirty: 1, del: 0 };
    bytes += (f ? JSON.stringify(f).length : 0) - (old && old.f ? JSON.stringify(old.f).length : 0);
    persist(c, id, r);
    stats.w++;
    return r;
  }
  function precond(r, cd) {
    if (!cd) return null;
    if (cd.exists === true && !r) return err(404, 'NOT_FOUND', 'No document to update');
    if (cd.exists === false && r) return err(409, 'ALREADY_EXISTS', 'Document already exists');
    if (cd.updateTime != null && (!r || r.ut !== cd.updateTime)) return err(400, 'FAILED_PRECONDITION', 'the stored version does not match the required base version');
    return null;
  }
  function applyTransforms(f, trs, tsNow) {
    const results = [];
    for (const t of trs || []) {
      const segs = fpSegs(t.fieldPath), cur = getPath(f, segs);
      let nv;
      if (t.increment) {
        const a = cur && TORD[vtype(cur)] === 2 ? cur : { integerValue: '0' };
        const dbl = vtype(a) === 'doubleValue' || vtype(t.increment) === 'doubleValue';
        const s = num(a) + num(t.increment);
        nv = dbl ? { doubleValue: s } : { integerValue: String(Math.trunc(s)) };
      } else if (t.maximum || t.minimum) {
        const x = t.maximum || t.minimum;
        nv = !cur || TORD[vtype(cur)] !== 2 ? clone(x) : ((t.maximum ? vcmp(x, cur) > 0 : vcmp(x, cur) < 0) ? clone(x) : cur);
      } else if (t.setToServerValue === 'REQUEST_TIME') nv = { timestampValue: tsNow };
      else if (t.appendMissingElements) {
        const vals = cur && cur.arrayValue ? (cur.arrayValue.values || []).slice() : [];
        for (const e of t.appendMissingElements.values || []) if (!vals.some((y) => veq(y, e))) vals.push(clone(e));
        nv = { arrayValue: vals.length ? { values: vals } : {} };
      } else if (t.removeAllFromArray) {
        const rm = t.removeAllFromArray.values || [];
        const vals = (cur && cur.arrayValue && cur.arrayValue.values || []).filter((y) => !rm.some((e) => veq(y, e)));
        nv = { arrayValue: vals.length ? { values: vals } : {} };
      } else throw new Unsupported('transform');
      setPath(f, segs, nv);
      results.push(nv);
    }
    return results;
  }
  /* עדכון לפי updateMask: שדה שבמסכה ולא בגוף — נמחק. בלי מסכה — המסמך מוחלף */
  function applyUpdate(r, fields, mask) {
    if (!mask) return clone(fields || {});
    const f = r ? clone(r.f) : {};
    for (const p of mask) {
      const s = fpSegs(p), v = getPath(fields || {}, s);
      if (v === undefined) delPath(f, s); else setPath(f, s, clone(v));
    }
    return f;
  }

  function listCol(c, qs) {
    for (const k of qs.keys()) if (!['pageSize', 'pageToken', 'mask.fieldPaths'].includes(k)) throw new Unsupported('list:' + k);
    const size = Math.min(Math.max(1, intOf(qs.get('pageSize')) || 300), 1000);
    const after = qs.get('pageToken') ? Buffer.from(qs.get('pageToken'), 'base64url').toString('utf8') : null;
    const ids = [...colMap(c).entries()].filter(([, r]) => !r.del).map(([id]) => id).sort();
    const from = after == null ? 0 : ids.findIndex((id) => id > after);
    const page = from < 0 ? [] : ids.slice(from, from + size);
    const mask = qs.getAll('mask.fieldPaths');
    const j = {};
    if (page.length) j.documents = page.map((id) => docJson(c, id, colMap(c).get(id), mask));
    if (from >= 0 && from + size < ids.length) j.nextPageToken = Buffer.from(page[page.length - 1], 'utf8').toString('base64url');
    return { status: 200, j, reads: Math.max(1, page.length) };
  }
  function query(sq) {
    for (const k of Object.keys(sq || {})) if (!SQ_KEYS.has(k)) throw new Unsupported('sq:' + k);
    const from = sq.from || [];
    if (from.length !== 1 || from[0].allDescendants || !ready(from[0].collectionId)) return null;
    const c = from[0].collectionId;
    let docs = [];
    for (const [id, r] of colMap(c)) if (!r.del) docs.push({ id, r, f: r.f, name: nameOf(c, id) });
    if (sq.where) docs = docs.filter((d) => evalFilter(sq.where, d));
    const ob = (sq.orderBy || []).map((x) => ({ fp: x.field.fieldPath, desc: x.direction === 'DESCENDING' }));
    for (const p of ineqFields(sq.where)) if (!ob.some((x) => x.fp === p)) ob.push({ fp: p, desc: false });
    if (!ob.length || ob[ob.length - 1].fp !== '__name__') ob.push({ fp: '__name__', desc: ob.length ? ob[ob.length - 1].desc : false });
    docs = docs.filter((d) => ob.every((x) => fieldOf(d, x.fp) !== undefined));
    docs.sort((a, b) => {
      for (const x of ob) {
        const cc = x.fp === '__name__' ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : vcmp(fieldOf(a, x.fp), fieldOf(b, x.fp));
        if (cc) return x.desc ? -cc : cc;
      }
      return 0;
    });
    const off = intOf(sq.offset) || 0, lim = intOf(sq.limit);
    docs = docs.slice(off, lim != null && lim >= 0 ? off + lim : undefined);
    const sel = sq.select ? (sq.select.fields || []).map((x) => x.fieldPath) : null;
    return { c, docs, sel };
  }
  function runQuery(body) {
    if (!body || body.transaction || body.newTransaction || body.readTime || !body.structuredQuery) throw new Unsupported('rq');
    const q = query(body.structuredQuery);
    if (!q) return null;
    const readTime = utOf(newUs());
    const j = q.docs.map((d) => {
      const doc = { name: d.name };
      const f = q.sel ? pick(d.f, q.sel) : d.f;
      if (f && Object.keys(f).length) doc.fields = f;
      doc.createTime = d.r.ct; doc.updateTime = d.r.ut;
      return { document: doc, readTime };
    });
    return { status: 200, j: j.length ? j : [{ readTime }], reads: Math.max(1, j.length) };
  }
  function runAgg(body) {
    const a = body && body.structuredAggregationQuery;
    if (!a || body.transaction || body.newTransaction || !a.structuredQuery) throw new Unsupported('agg');
    const aggs = a.aggregations || [];
    if (!aggs.length || aggs.some((x) => !x.count)) throw new Unsupported('agg:kind');
    const q = query(a.structuredQuery);
    if (!q) return null;
    const out = {};
    for (const x of aggs) {
      const up = x.count.upTo != null ? intOf(x.count.upTo) : null;
      out[x.alias || 'field_1'] = { integerValue: String(up != null ? Math.min(up, q.docs.length) : q.docs.length) };
    }
    return { status: 200, j: [{ result: { aggregateFields: out }, readTime: utOf(newUs()) }], reads: 1 };
  }
  function patch(c, id, qs, body) {
    for (const k of qs.keys()) if (!['updateMask.fieldPaths', 'mask.fieldPaths', 'currentDocument.exists', 'currentDocument.updateTime'].includes(k)) throw new Unsupported('patch:' + k);
    if (!body || typeof body !== 'object') throw new Unsupported('patch:body');
    const r = live(c, id);
    const cd = {};
    if (qs.has('currentDocument.exists')) cd.exists = qs.get('currentDocument.exists') === 'true';
    if (qs.has('currentDocument.updateTime')) cd.updateTime = qs.get('currentDocument.updateTime');
    const e = precond(r, Object.keys(cd).length ? cd : null);
    if (e) return e;
    const mask = qs.has('updateMask.fieldPaths') ? qs.getAll('updateMask.fieldPaths') : null;
    const nr = writeLocal(c, id, applyUpdate(r, body.fields, mask));
    return { status: 200, j: docJson(c, id, nr, qs.getAll('mask.fieldPaths')) };
  }
  function del(c, id, qs) {
    for (const k of qs.keys()) if (!['currentDocument.exists', 'currentDocument.updateTime'].includes(k)) throw new Unsupported('del:' + k);
    const r = live(c, id);
    const cd = {};
    if (qs.has('currentDocument.exists')) cd.exists = qs.get('currentDocument.exists') === 'true';
    if (qs.has('currentDocument.updateTime')) cd.updateTime = qs.get('currentDocument.updateTime');
    const e = precond(r, Object.keys(cd).length ? cd : null);
    if (e) return e;
    if (r) writeLocal(c, id, null);
    return { status: 200, j: {} };
  }
  function commit(body) {
    if (!body || body.transaction || !Array.isArray(body.writes)) throw new Unsupported('commit');
    const ws = [];
    for (const w of body.writes) {
      const nm = C.parseName(w.delete || (w.update && w.update.name) || (w.transform && w.transform.document));
      if (!nm || nm.project !== project || !ready(nm.col)) return null;   // כתיבה לאוסף אחר באותו commit — הכל ל־Firestore
      for (const k of Object.keys(w)) if (!['update', 'delete', 'transform', 'updateMask', 'updateTransforms', 'currentDocument'].includes(k)) throw new Unsupported('commit:' + k);
      ws.push({ w, nm });
    }
    const work = new Map();   // col/id → f | null (במהלך ה־commit)
    const key = (nm) => nm.col + '/' + nm.id;
    const cur = (nm) => (work.has(key(nm)) ? work.get(key(nm)) : (live(nm.col, nm.id) ? live(nm.col, nm.id).f : null));
    const tsNow = utOf(newUs());
    const results = [];
    for (const { w, nm } of ws) {
      const f0 = cur(nm);
      // מסמך שכבר השתנה באותו commit: קיים/לא קיים לפי המצב החדש, ו־updateTime הישן כבר לא תקף
      const base = work.has(key(nm)) ? (f0 ? { ut: '' } : null) : live(nm.col, nm.id);
      const e = precond(base, w.currentDocument);
      if (e) return e;
      let f, tr = [];
      if (w.delete) { work.set(key(nm), null); results.push({}); continue; }
      if (w.update) {
        const mask = w.updateMask && Array.isArray(w.updateMask.fieldPaths) ? w.updateMask.fieldPaths : null;
        f = applyUpdate(f0 ? { f: f0 } : null, w.update.fields, mask);
        tr = applyTransforms(f, w.updateTransforms, tsNow);
      } else {
        f = f0 ? clone(f0) : {};
        tr = applyTransforms(f, w.transform.fieldTransforms, tsNow);
      }
      work.set(key(nm), f);
      results.push(tr.length ? { transformResults: tr } : {});
    }
    const uts = new Map();
    for (const [k, f] of work) {
      const i = k.indexOf('/'), c = k.slice(0, i), id = k.slice(i + 1);
      if (f == null) { if (live(c, id)) writeLocal(c, id, null); uts.set(k, tsNow); }
      else uts.set(k, writeLocal(c, id, f).ut);
    }
    const commitTime = utOf(newUs());
    return { status: 200, j: { writeResults: ws.map(({ w, nm }, i) => Object.assign(w.delete ? {} : { updateTime: uts.get(key(nm)) }, results[i])), commitTime } };
  }

  /* הבקשה בצורה של Firestore REST → { status, j } או null (ממשיכים ל־Firestore) */
  function handle(method, url, body) {
    const u = C.parseUrl(url);
    if (!u || u.project !== project) return null;
    const pass = (why) => { stats.pass++; stats.passWhy[why] = (stats.passWhy[why] || 0) + 1; return null; };
    let r = null;
    try {
      if (!u.verb && u.path.length === 2) {
        if (!ready(u.path[0])) return null;
        const [c, id] = u.path;
        if (method === 'GET') {
          for (const k of u.qs.keys()) if (k !== 'mask.fieldPaths') throw new Unsupported('get:' + k);
          const d = live(c, id);
          r = d ? { status: 200, j: docJson(c, id, d, u.qs.getAll('mask.fieldPaths')), reads: 1 }
            : Object.assign(err(404, 'NOT_FOUND', 'Document "' + nameOf(c, id) + '" not found.'), { reads: 1 });
        } else if (method === 'PATCH') r = patch(c, id, u.qs, body);
        else if (method === 'DELETE') r = del(c, id, u.qs);
        else throw new Unsupported('method');
      } else if (!u.verb && u.path.length === 1) {
        if (!ready(u.path[0])) return null;
        if (method !== 'GET') throw new Unsupported('colmethod');
        r = listCol(u.path[0], u.qs);
      } else if (!u.path.length && method === 'POST' && u.verb === 'runQuery') r = runQuery(body);
      else if (!u.path.length && method === 'POST' && u.verb === 'runAggregationQuery') r = runAgg(body);
      else if (!u.path.length && method === 'POST' && u.verb === 'commit') r = commit(body);
      else return null;
    } catch (e) {
      if (e && e.unsup) return pass(e.unsup);
      throw e;
    }
    if (!r) return null;
    stats.loc++; stats.locReads += r.reads || 0;
    return r;
  }

  /* ---------- בשביל lib/ldbsync.js ---------- */
  /* מסמך מ־Firestore (ייבוא / איחוד / תשובה של כתיבה שעברה ל־Firestore). ifNewer — רק אם updateTime שלו חדש ממה שיש.
     השדה _mt (מתי נכתב מקומית — נכתב רק לעותק) לא נכנס למסד */
  function putRemote(c, id, d, opt = {}) {
    const old = colMap(c).get(id);
    const utu = parseUt(d && d.updateTime);
    if (opt.ifNewer && old && (old.dirty || (old.utu || 0) >= utu)) return false;
    const f = clone((d && d.fields) || {});
    delete f._mt;
    const r = { f, ct: (d && d.createTime) || (old && old.ct) || d.updateTime, ut: opt.ut || d.updateTime || utOf(newUs()), utu: opt.ut ? parseUt(opt.ut) : utu,
      lw: opt.lw != null ? opt.lw : 0, dirty: opt.dirty ? 1 : 0, del: 0 };
    bytes += JSON.stringify(f).length - (old && old.f ? JSON.stringify(old.f).length : 0);
    persist(c, id, r);
    return true;
  }
  /* מחיקה שהגיעה מבחוץ (ב־Firestore כבר נמחק) — מצבה נקייה */
  function putTomb(c, id, opt = {}) {
    const old = colMap(c).get(id);
    if (opt.ifNewer && old && old.dirty) return false;
    if (old && old.f) bytes -= JSON.stringify(old.f).length;
    const us = opt.us || newUs();
    persist(c, id, { f: null, ct: null, ut: utOf(us), utu: us, lw: opt.lw != null ? opt.lw : nowMs(), dirty: opt.dirty ? 1 : 0, del: 1 });
    return true;
  }
  /* מיזוג שדות מבחוץ לתוך מסמך מקומי שעוד לא נשלח לעותק (האיחוד: Vercel כתב אחרי השינוי המקומי) */
  function mergeFields(c, id, fields, top) {
    const old = live(c, id);
    const f = old ? clone(old.f) : {};
    for (const k of top) { if (fields && fields[k] !== undefined) f[k] = clone(fields[k]); else delete f[k]; }
    return writeLocal(c, id, f);
  }
  function dirtyRows(limit = 400) {
    const out = [];
    for (const [c, m] of mem) for (const [id, r] of m) if (r.dirty) { out.push({ col: c, id, r }); }
    out.sort((a, b) => (a.r.lw || 0) - (b.r.lw || 0));
    return out.slice(0, limit);
  }
  /* העותק קיבל את המצב שנכתב ב־lw — מנקים (אם לא נכתב שוב בינתיים) */
  function markClean(c, id, lw) {
    const r = colMap(c).get(id);
    if (!r || r.lw !== lw || !r.dirty) return false;
    r.dirty = 0;
    st.clean.run(c, id, lw);
    return true;
  }
  /* מצבות נקיות שעברו maxAge — נמחקות מהמסד */
  function purgeTombs(maxAgeMs) {
    let n = 0;
    for (const [c, m] of mem) for (const [id, r] of m) if (r.del && !r.dirty && nowMs() - (r.lw || 0) > maxAgeMs) { m.delete(id); st.rm.run(c, id); n++; }
    return n;
  }
  function setCol(c, v) { const x = Object.assign({ st: 'imp', pt: '', n: 0, at: 0 }, cols.get(c) || {}, v); cols.set(c, x); st.colPut.run(c, x.st, x.pt || '', x.n || 0, x.at || 0); return x; }
  function kv(k, v) {
    if (v === undefined) { const r = st.kvGet.get(k); if (!r) return null; try { return JSON.parse(r.v); } catch (e) { return null; } }
    st.kvPut.run(k, JSON.stringify(v));
    return v;
  }
  /* תמונת מצב: כל המסד כ־JSON — בלי קבצים, כך שהיא עובדת גם כשהמסד בזיכרון (lib/ldbsync.js, מצב mem) */
  function dump() {
    const docs = [];
    for (const [c, m] of mem) for (const [id, r] of m) docs.push([c, id, r.del ? null : r.f, r.ct || null, r.ut || null, r.utu || 0, r.lw || 0, r.dirty ? 1 : 0, r.del ? 1 : 0]);
    return { cols: [...cols.entries()].map(([c, x]) => [c, x.st, x.pt || '', x.n || 0, x.at || 0]), kv: db.prepare('SELECT k, v FROM kv').all().map((r) => [r.k, r.v]), docs };
  }
  function load(d) {
    db.exec('BEGIN');
    try {
      for (const [c, cst, pt, n, at] of d.cols || []) setCol(c, { st: cst, pt, n, at });
      for (const [k, v] of d.kv || []) st.kvPut.run(k, v);
      for (const [c, id, f, ct, ut, utu, lw, dirty, del] of d.docs || []) {
        persist(c, id, { f: del ? null : f, ct, ut, utu, lw, dirty: dirty ? 1 : 0, del: del ? 1 : 0 });
        if (f && !del) bytes += JSON.stringify(f).length;
      }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  function info() {
    let docs = 0, dirty = 0;
    for (const m of mem.values()) for (const r of m.values()) { if (!r.del) docs++; if (r.dirty) dirty++; }
    const c = [...cols.entries()];
    return { docs, dirty, mb: Math.round(bytes / 1e5) / 10, ready: c.filter(([, x]) => x.st === 'ready').length, cols: c.length };
  }
  const get = (c, id) => { const r = live(c, id); return r ? { f: clone(r.f), ut: r.ut, lw: r.lw, dirty: r.dirty } : null; };
  const rec = (c, id) => colMap(c).get(id) || null;

  return { project, db, handle, ready, cols, setCol, kv, dump, load, putRemote, putTomb, mergeFields, dirtyRows, markClean, purgeTombs, info, stats, get, rec,
    close: () => db.close(), _mem: mem };
}

module.exports = { createStore, vcmp, veq, fpSegs, utOf, parseUt, evalFilter, Unsupported };
