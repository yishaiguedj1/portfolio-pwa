'use strict';
/* מנהל הספרייה (ס׳1, 11/10/2026) — הקטלוג של המדף המשותף ב־R2 ופעולות השרתון. api/library.js מעביר לכאן את ה־ops החדשים.
   הקטלוג: lib/v2/cat.json.gz (מקור האמת, רק השרתון כותב, תמיד בכתיבה מותנית If-Match → אין דריסה בין שני מכשירים),
   ומתוכו נגזרים בכל כתיבה: מבט הקורא lib/v2/pub.json.gz (רק מה שפורסם) וגרסה בארכיון lib/v2/arc/<v>.json.gz.
   במופע נשמר עותק בזיכרון עד 10 שנ׳ (MEMO_MS), ואחר כך קריאה מותנית (ETag) — "אין שינוי" לא עולה קריאה מלאה.
   הקבצים עצמם לא עוברים כאן: הטלפון מוריד ומעלה ישירות מ־R2 בקישורים חתומים. */
const zlib = require('zlib');
const crypto = require('crypto');
const R2 = require('./r2');
const C = require('./libcat');
const BY = require('./benyehuda');
const GC = require('./libgc');

const MEMO_MS = 10000;
const CAT_MAX = 16 * 1024 * 1024;        // הקטלוג הדחוס (2,000 ספרים ≈ 0.5–1.3MB)
const INLINE_MAX = 2 * 1024 * 1024;      // מעבר לזה התשובה = קישור חתום (Vercel: תשובה עד 4.5MB)
const URL_TTL = 3600;
let memo = null;                         // { etag, cat, at }

const r2c = () => { const c = R2.config(); return c.ok ? c : null; };
const rdeps = (deps) => ({ fetch: deps.fetch, now: () => deps.now || Date.now() });
const nowOf = (deps) => deps.now || Date.now();
const count = (o) => Object.keys(o || {}).length;
const gz = (obj) => zlib.gzipSync(Buffer.from(JSON.stringify(obj), 'utf8'));

async function loadCat(deps, fresh) {
  const c = r2c();
  if (!c) throw new Error('no_r2');
  const now = nowOf(deps);
  if (memo && !fresh && now - memo.at < MEMO_MS) return memo;
  const r = await R2.getCond(c, rdeps(deps), C.KEYS.cat, CAT_MAX, memo && memo.etag);
  if (r.status === 304 && memo) { memo.at = now; return memo; }
  if (r.status === 404) { memo = { etag: '', cat: C.emptyCatalog(), at: now }; return memo; }
  const cat = C.normCatalog(JSON.parse(zlib.gunzipSync(r.buf).toString('utf8')));
  memo = { etag: r.etag, cat, at: now };
  return memo;
}

/* כתיבה בתנאי (CAS): fn(קטלוג) → { cat, n, … }. 412 = מישהו הקדים → טוענים שוב ומחילים שוב. 429 = כתיבה בשנייה לאותו מפתח.
   rid = מזהה בקשה מהטלפון: בקשה שחוזרת אחרי ניתוק לא מוחלת פעמיים. allowShrink = מותר שהקטלוג יקטן ביותר מ־30% */
async function writeCat(deps, fn, opt = {}) {
  const c = r2c();
  if (!c) throw new Error('no_r2');
  const rd = rdeps(deps);
  const sleep = deps.sleep || ((ms) => new Promise((ok) => setTimeout(ok, ms)));
  for (let i = 0; i < 6; i++) {
    const cur = await loadCat(deps, i > 0);
    if (opt.rid && cur.cat.rids[opt.rid]) return { v: cur.cat.rids[opt.rid], dup: true, n: 0 };
    const res = fn(cur.cat);
    if (!res.n) { const out = Object.assign({}, res, { v: cur.cat.v }); delete out.cat; return out; }
    const next = res.cat;
    if (opt.rid) {
      const keys = Object.keys(next.rids || {});
      const rids = {};
      for (const k of keys.slice(-299)) rids[k] = next.rids[k];
      rids[opt.rid] = next.v;
      next.rids = rids;
    }
    const n0 = count(cur.cat.books), n1 = count(next.books);
    if (!opt.allowShrink && n0 >= 10 && n1 < n0 * 0.7) throw new Error('shrink');
    const body = gz(next);
    if (body.length > CAT_MAX) throw new Error('too_big');
    const put = await R2.putCond(c, rd, C.KEYS.cat, body, { type: 'application/gzip',
      ifMatch: cur.etag || undefined, ifNoneMatch: cur.etag ? undefined : '*', meta: { v: String(next.v) } });
    if (put.status === 412) { memo = null; await sleep(80 + Math.floor(Math.random() * 300)); continue; }
    if (put.status === 429) { await sleep(1100 + Math.floor(Math.random() * 400)); continue; }
    memo = { etag: put.etag, cat: next, at: nowOf(deps) };
    // הנגזרים — "הכי טוב שאפשר": מבט קורא שפיגר נבנה מחדש בקריאה הבאה (ensurePub), והארכיון לא חוסם
    await Promise.all([
      R2.putCond(c, rd, C.KEYS.pub, gz(C.pubView(next)), { type: 'application/gzip', meta: { v: String(next.v) } }).catch(() => null),
      R2.putCond(c, rd, C.KEYS.arc(next.v), body, { type: 'application/gzip', ifNoneMatch: '*' }).catch(() => null),
    ]);
    const out = Object.assign({}, res, { v: next.v });
    delete out.cat;
    return out;
  }
  throw new Error('busy');
}

/* קישור חתום למבט הקורא המלא — אחרי וידוא שהוא בגרסה של הקטלוג */
async function pubUrl(deps, cat) {
  const c = r2c(), rd = rdeps(deps);
  const h = await R2.head(c, rd, C.KEYS.pub).catch(() => null);
  if (!h || String(h.v) !== String(cat.v)) await R2.putCond(c, rd, C.KEYS.pub, gz(C.pubView(cat)), { type: 'application/gzip', meta: { v: String(cat.v) } });
  return R2.presign(c, rd, { method: 'GET', key: C.KEYS.pub, expires: 600 });
}

/* תצוגת המנהל: כל הספרים (גם טיוטות וסל), ויומן בלי הערכים הקודמים */
function adminView(cat) {
  return { schema: cat.schema, v: cat.v, at: cat.at, books: cat.books, cfg: cat.cfg || { source: 'drive' },
    hist: cat.hist.slice(-60).map((h) => ({ v: h.v, at: h.at, by: h.by, k: h.k, n: h.n, f: h.f, ids: h.ids.slice(0, 50), undo: !!h.inv })) };
}

/* ---------------------------------------------------------------- ס׳2: מעבר מ־Drive + העלאות
   המעבר שומר על המזהה המקומי של כל ספר (id-<dc:identifier>) ועל ה־md5 של Drive (= MD5 של התוכן, = ETag של R2),
   ולכן אף קורא לא מוריד שוב. הטלפון של המנהל שולח לכל קובץ ב־Drive את הרשומה שלו (הפרטים שהוא רואה, כולל עריכות);
   השרתון מאמת מול Drive, מזהה את הסוג לפי התוכן, ומעתיק את העותק שכבר ב־R2 (lib/<driveId>.<md5>.epub) למקומו החדש. */
const MIG_MAX = 40;
const UP_MAX = 40;
const COVER_MAX = 400 * 1024;
const BOOK_MAX = 100 * 1024 * 1024;
const UP_TTL = 900;
const LEGACY_RE = /^lib\/([A-Za-z0-9_-]{10,100})\.([a-f0-9]{32})\.epub$/;
const legacyKey = (id, md5) => 'lib/' + id + '.' + md5 + '.epub';
const extOf = (name) => { const m = /\.([a-z0-9]{2,5})$/i.exec(String(name || '')); return m ? m[1].toLowerCase() : ''; };
/* הסוג הסופי: לפי התוכן, והסיומת רק מבחינה בין azw3 ל־mobi (אותה מעטפת) או מאשרת EPUB בלי mimetype ראשון */
function fmtFor(ext, sn) {
  if (sn === 'epub' || (sn === 'zip' && ext === 'epub')) return 'epub';
  if (sn === 'mobi') return ['azw3', 'azw', 'kf8'].includes(ext) ? 'azw3' : 'mobi';
  if (sn === 'fb2') return 'fb2';
  return '';
}
const isJpeg = (b) => b && b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const TYPES = { epub: 'application/epub+zip', azw3: 'application/vnd.amazon.ebook', mobi: 'application/x-mobipocket-ebook', fb2: 'application/x-fictionbook+xml' };
/* רשומת ספר מהטלפון (ייבוא / מעבר): רק השדות, נעילה לשדות שנערכו ביד, ומקור לכל שדה */
function bookFrom(src, extra) {
  const b = src && typeof src === 'object' ? src : {};
  const lock = (Array.isArray(b.lock) ? b.lock : []).filter((k) => C.FIELDS.includes(k));
  const o = { id: b.id, st: b.st === 'pub' || b.st === 'hide' ? b.st : 'draft', lock, prov: {} };
  for (const k of C.FIELDS) if (b[k] != null) { o[k] = b[k]; o.prov[k] = lock.includes(k) ? 'user' : (C.SOURCES.includes(b.src) ? b.src : 'file'); }
  return Object.assign(o, extra || {});
}

async function migratePlan(deps, legacy) {
  const c = r2c(), rd = rdeps(deps);
  const lst = await legacy.list();
  const mirror = new Set();
  for (const o of await R2.list(c, rd, 'lib/', 5000)) { const m = LEGACY_RE.exec(o.key); if (m) mirror.add(o.key); }
  const { cat } = await loadCat(deps, true);
  const done = Object.create(null);
  for (const id of Object.keys(cat.books)) { const b = cat.books[id]; if (b.legacy && !b.del) done[b.legacy.driveId] = id; }
  return { v: cat.v, src: (cat.cfg && cat.cfg.source) || 'drive', from: lst.r2only ? 'r2' : 'drive',
    items: lst.items.map((i) => ({ id: i.id, name: i.name, size: i.size, md5: i.md5, m: mirror.has(legacyKey(i.id, i.md5)) ? 1 : 0, c: done[i.id] || '' })) };
}

async function migrateCommit(deps, legacy, body, ctx, rid) {
  const c = r2c(), rd = rdeps(deps);
  const want = (Array.isArray(body.items) ? body.items : []).slice(0, MIG_MAX);
  if (!want.length) { const e = new Error('bad_op'); e.why = 'items'; throw e; }
  const lst = await legacy.list();
  const byId = new Map(lst.items.map((i) => [i.id, i]));
  const { cat } = await loadCat(deps, true);
  const byLegacy = Object.create(null);
  for (const id of Object.keys(cat.books)) { const b = cat.books[id]; if (b.legacy) byLegacy[b.legacy.driveId] = id; }
  const out = { done: [], skip: [], dup: [], missing: [], bad: [] };
  const adds = [];
  for (const w of want) {
    const d = String(w && w.d || ''), it = byId.get(d), bk = w && w.book;
    if (!it || !C.MD5_RE.test(it.md5)) { out.missing.push(d.slice(0, 100)); continue; }
    if (!bk || !C.idOk(bk.id)) { out.bad.push({ d, why: 'book' }); continue; }
    if (byLegacy[d]) { out.skip.push(d); continue; }                                   // כבר עבר (המשך אחרי ניתוק)
    if (cat.books[bk.id] || adds.some((a) => a.id === bk.id)) { out.dup.push({ d, id: bk.id }); continue; }   // אותו dc:identifier בשני קבצים
    const lk = legacyKey(d, it.md5);
    let head = await R2.getRange(c, rd, lk, 0, 65535).catch(() => null), full = null;
    if (!head) { full = await legacy.download(it).catch(() => null); head = full && full.buf; }
    if (!head) { out.missing.push(d); continue; }
    const fmt = fmtFor(extOf(it.name), C.sniff(head));
    if (!fmt) { out.bad.push({ d, why: 'type' }); continue; }
    const f = { fmt, md5: it.md5, size: it.size || (full && full.buf.length) || 0, at: ctx.now };
    const fk = C.KEYS.file(f);
    if (!await R2.head(c, rd, fk).catch(() => null)) {
      let etag = '';
      if (full && full.buf) { await R2.putBuf(c, rd, fk, full.buf, TYPES[fmt]); etag = crypto.createHash('md5').update(full.buf).digest('hex'); }
      else etag = String(await R2.copy(c, rd, lk, fk, TYPES[fmt]) || '').replace(/"/g, '');
      if (etag && etag !== it.md5) { await R2.del(c, rd, fk).catch(() => {}); out.bad.push({ d, why: 'md5' }); continue; }
    }
    adds.push(bookFrom(Object.assign({}, bk, { st: bk.st === 'hide' ? 'hide' : 'pub' }), { files: [f], legacy: { driveId: d }, batch: 'migrate', added: ctx.now }));
    out.done.push(d);
  }
  let v = cat.v;
  if (adds.length) {
    const r = await writeCat(deps, (cur) => {
      const ops = adds.filter((a) => !cur.books[a.id]).map((book) => ({ op: 'add', book }));
      return ops.length ? C.applyOps(cur, ops, Object.assign({}, ctx, { internal: true })) : { cat: cur, n: 0 };
    }, { rid });
    v = r.v;
  }
  return Object.assign({ v }, out);
}

/* העלאה (ייבוא ספרים / כריכות): קישור PUT חתום לקובץ זמני → upCommit בודק גודל ותוכן, מעתיק למקום הסופי לפי md5 ומוחק את הזמני.
   המפתחות נבנים רק כאן; הטלפון לא בוחר שום מפתח */
async function upPlan(deps, body) {
  const c = r2c(), rd = rdeps(deps);
  const want = (Array.isArray(body.items) ? body.items : []).slice(0, UP_MAX);
  if (!want.length) { const e = new Error('bad_op'); e.why = 'items'; throw e; }
  const items = [];
  for (const w of want) {
    const k = w && w.k === 'c' ? 'c' : 'b', size = Number(w && w.size) || 0;
    if (size <= 0 || size > (k === 'c' ? COVER_MAX : BOOK_MAX)) { items.push({ err: 'size' }); continue; }
    const u = crypto.randomBytes(16).toString('hex');
    items.push({ u, url: await R2.presign(c, rd, { method: 'PUT', key: C.KEYS.tmp(u), expires: UP_TTL }) });
  }
  return { items, exp: nowOf(deps) + UP_TTL * 1000 };
}

async function upCommit(deps, body, ctx, rid) {
  const c = r2c(), rd = rdeps(deps);
  const want = (Array.isArray(body.items) ? body.items : []).slice(0, UP_MAX);
  if (!want.length) { const e = new Error('bad_op'); e.why = 'items'; throw e; }
  const { cat } = await loadCat(deps, true);
  const byMd5 = Object.create(null);
  for (const id of Object.keys(cat.books)) for (const f of cat.books[id].files || []) byMd5[f.md5] = id;
  const out = { done: [], dup: [], bad: [] }, ops = [];
  for (const w of want) {
    const tk = C.KEYS.tmp(w && w.u);
    if (!tk) { out.bad.push({ u: '', why: 'u' }); continue; }
    const h = await R2.head(c, rd, tk).catch(() => null);
    if (!h) { out.bad.push({ u: w.u, why: 'missing' }); continue; }
    const md5 = String(h.etag || '').toLowerCase();
    const drop = () => R2.del(c, rd, tk).catch(() => {});
    const k = w.k === 'c' ? 'c' : 'b';
    if (!C.MD5_RE.test(md5) || h.size <= 0 || h.size > (k === 'c' ? COVER_MAX : BOOK_MAX)) { await drop(); out.bad.push({ u: w.u, why: 'size' }); continue; }
    const head = await R2.getRange(c, rd, tk, 0, 65535).catch(() => null);
    if (k === 'c') {
      const b = cat.books[w.id];
      if (!b || b.del) { await drop(); out.bad.push({ u: w.u, why: 'book' }); continue; }
      if (!isJpeg(head)) { await drop(); out.bad.push({ u: w.u, why: 'type' }); continue; }
      const ck = C.KEYS.cover(md5);
      if (!await R2.head(c, rd, ck).catch(() => null)) await R2.copy(c, rd, tk, ck, 'image/jpeg');
      await drop();
      ops.push({ op: 'cover', id: b.id, cover: { h: md5, r: w.r, bg: w.bg }, src: C.SOURCES.includes(w.src) ? w.src : 'user' });
      out.done.push({ u: w.u, id: b.id });
      continue;
    }
    const fmt = fmtFor(String(w.ext || '').toLowerCase(), C.sniff(head));
    if (!fmt) { await drop(); out.bad.push({ u: w.u, why: 'type' }); continue; }
    const f = { fmt, md5, size: h.size, at: ctx.now };
    const target = w.id && cat.books[w.id] && !cat.books[w.id].del ? w.id : '';
    if (!target && byMd5[md5]) { await drop(); out.dup.push({ u: w.u, id: byMd5[md5] }); continue; }   // אותו קובץ כבר בספרייה
    if (!target && (!w.book || !C.idOk(w.book.id) || cat.books[w.book.id])) { await drop(); out.bad.push({ u: w.u, why: 'book' }); continue; }
    const fk = C.KEYS.file(f);
    if (!await R2.head(c, rd, fk).catch(() => null)) await R2.copy(c, rd, tk, fk, TYPES[fmt]);
    await drop();
    if (target) ops.push({ op: 'file', id: target, file: f });
    else ops.push({ op: 'add', book: bookFrom(w.book, { files: [f], batch: /^[A-Za-z0-9_-]{4,40}$/.test(String(w.batch || '')) ? w.batch : undefined, added: ctx.now }) });
    out.done.push({ u: w.u, id: target || w.book.id, fmt, md5 });
  }
  let v = cat.v;
  if (ops.length) {
    const r = await writeCat(deps, (cur) => {
      const ok = ops.filter((o) => (o.op === 'add' ? !cur.books[o.book.id] : !!cur.books[o.id]));
      return ok.length ? C.applyOps(cur, ok.slice(0, 50), Object.assign({}, ctx, { internal: true })) : { cat: cur, n: 0 };
    }, { rid });
    v = r.v;
  }
  return Object.assign({ v }, out);
}

/* תאימות לגרסאות ישנות של הטלפון (list/file/insight של v1) אחרי שהמקור הוא R2: הרשימה נבנית מהקטלוג.
   מזהה ישן = ה־driveId (כך טלפון ישן לא רואה שינוי ולא מוריד שוב); ספר חדש = 'v2' + md5. null = המקור עדיין Drive */
async function compat(deps) {
  if (!r2c()) return null;
  const { cat } = await loadCat(deps);
  if (((cat.cfg && cat.cfg.source) || 'drive') !== 'r2') return null;
  const items = [], byId = new Map();
  for (const id of Object.keys(cat.books)) {
    const b = cat.books[id];
    if (!C.visible(b)) continue;
    const f = b.files[0];
    const cid = (b.legacy && b.legacy.driveId) || 'v2' + f.md5;
    const name = String(b.title || 'book').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').slice(0, 120).trim() + '.' + f.fmt;
    const it = { id: cid, name, size: f.size, md5: f.md5, modified: new Date(f.at || b.updated || 0).toISOString() };
    items.push(it);
    const rec = { item: it, book: b, key: C.KEYS.file(f) };
    byId.set(cid, rec); byId.set(id, rec);
  }
  return { items, byId };
}

/* ס׳8 — פרויקט בן־יהודה: חיפוש בקטלוג (בזיכרון של המופע, יום) והורדה ישר לקובץ זמני ב־R2 — הטלפון קורא אותו, בודק ומאשר
   בדיוק כמו העלאה שלו (upCommit), בלי להוריד ולהעלות שוב */
const BY_MAX = 40 * 1024 * 1024;
let byCat = null;   // { at, list }
async function byLoad(deps) {
  if (byCat && nowOf(deps) - byCat.at < 86400000) return byCat.list;
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 20000);
  try {
    const r = await (deps.fetch || fetch)(BY.CAT_URL, { signal: ac.signal, headers: { 'User-Agent': 'TheSnowball-Library/1.0' } });
    if (r.status !== 200) throw new Error('by_http_' + r.status);
    const list = BY.parseCatalog(await r.text());
    if (!list.length) throw new Error('by_empty');
    byCat = { at: nowOf(deps), list };
    return list;
  } finally { clearTimeout(t); }
}
async function byDownload(deps, id) {
  const f = deps.fetch || fetch;
  let cur = BY.dlUrl(id), r = null;
  for (let hop = 0; ; hop++) {
    if (!BY.dlAllowed(cur)) throw new Error('by_redirect');
    r = await f(cur, { redirect: 'manual', headers: { 'User-Agent': 'TheSnowball-Library/1.0' } });
    if (r.status < 300 || r.status >= 400) break;
    const loc = r.headers.get('location');
    if (!loc || hop >= 4) throw new Error('by_redirects');
    cur = new URL(loc, cur).href;
  }
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error('by_http_' + r.status);
  if (+(r.headers.get('content-length') || 0) > BY_MAX) throw new Error('by_size');
  const buf = Buffer.from(await r.arrayBuffer());
  if (!buf.length || buf.length > BY_MAX) throw new Error('by_size');
  return buf;
}

const ADMIN_OPS = new Set(['adminCat', 'catApply', 'undo', 'migratePlan', 'migrateCommit', 'migrateFinish', 'upPlan', 'upCommit', 'byFind', 'byAdd']);
const OPS = new Set(['cat', 'urls', ...ADMIN_OPS]);
const BIG_OPS = new Set(['catApply', 'undo', 'migrateCommit', 'upCommit', 'upPlan']);
const RID_RE = /^[A-Za-z0-9_-]{6,64}$/;

/* op מהטלפון (אחרי אימות + הרשאת קורא ב־api/library.js). admin = isAdmin(user) */
async function handle(op, body, user, admin, res, deps = {}, legacy = null) {
  if (!r2c()) return res.status(503).json({ ok: false, error: 'no_r2' });
  if (ADMIN_OPS.has(op) && !admin) return res.status(403).json({ ok: false, error: 'not_admin' });
  try {
    if (op === 'cat' || op === 'adminCat') {
      const { cat } = await loadCat(deps);
      const src = (cat.cfg && cat.cfg.source) || 'drive';
      const have = Number.isInteger(body.have) ? body.have : -1;
      if (have === cat.v) return res.status(200).json({ ok: true, v: cat.v, same: true, src });
      if (op === 'cat') {
        const d = C.delta(cat, have);
        if (d && !d.same) return res.status(200).json({ ok: true, v: cat.v, up: d.up, rm: d.rm, src });
        const view = C.pubView(cat);
        if (JSON.stringify(view).length <= INLINE_MAX) return res.status(200).json({ ok: true, v: cat.v, full: view, src });
        return res.status(200).json({ ok: true, v: cat.v, url: await pubUrl(deps, cat), src });
      }
      const view = adminView(cat);
      if (JSON.stringify(view).length <= INLINE_MAX) return res.status(200).json({ ok: true, v: cat.v, full: view, src });
      const c = r2c();
      return res.status(200).json({ ok: true, v: cat.v, url: await R2.presign(c, rdeps(deps), { method: 'GET', key: C.KEYS.cat, expires: 600 }), gz: 1, src });
    }
    if (op === 'urls') {
      const kind = body.kind === 'c' ? 'c' : 'f';
      const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter(C.idOk))].slice(0, 200) : [];
      if (!ids.length) return res.status(400).json({ ok: false, error: 'bad_ids' });
      const { cat } = await loadCat(deps);
      const c = r2c(), rd = rdeps(deps), urls = {};
      for (const id of ids) {
        const b = cat.books[id];
        if (!b || !(C.visible(b) || (admin && !b.del))) continue;   // טיוטות — רק למנהל
        const key = kind === 'c' ? (b.cover ? C.KEYS.cover(b.cover.h) : '') : (b.files && b.files.length ? C.KEYS.file(b.files[0]) : '');
        if (key) urls[id] = await R2.presign(c, rd, { method: 'GET', key, expires: URL_TTL });
      }
      return res.status(200).json({ ok: true, v: cat.v, urls, exp: nowOf(deps) + URL_TTL * 1000 });
    }
    const rid = RID_RE.test(String(body.rid || '')) ? String(body.rid) : '';
    const ctx = { now: nowOf(deps), by: user.email || '' };
    if (op === 'migratePlan' || op === 'migrateCommit') {
      if (!legacy) return res.status(503).json({ ok: false, error: 'no_drive' });
      const out = op === 'migratePlan' ? await migratePlan(deps, legacy) : await migrateCommit(deps, legacy, body, ctx, rid);
      return res.status(200).json(Object.assign({ ok: true }, out));
    }
    if (op === 'migrateFinish') {
      const r = await writeCat(deps, (cat) => C.applyOps(cat, [{ op: 'cfg', source: body.back ? 'drive' : 'r2' }], Object.assign({}, ctx, { internal: true })), { rid });
      return res.status(200).json({ ok: true, v: r.v, src: body.back ? 'drive' : 'r2' });
    }
    if (op === 'byFind') {
      const list = await byLoad(deps);
      const g = Object.values(BY.GENRE).includes(body.g) ? body.g : '';
      return res.status(200).json(Object.assign({ ok: true }, BY.search(list, String(body.q || '').slice(0, 80), 200, g)));
    }
    if (op === 'byAdd') {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter((x) => Number.isInteger(x) && x > 0).slice(0, 5);
      if (!ids.length) return res.status(400).json({ ok: false, error: 'bad_ids' });
      const c = r2c(), rd = rdeps(deps);
      const items = await Promise.all(ids.map(async (id) => {
        try {
          const buf = await byDownload(deps, id);
          if (!buf) return { id, err: 'not_found' };
          const u = crypto.randomBytes(16).toString('hex');
          await R2.putBuf(c, rd, C.KEYS.tmp(u), buf, 'application/epub+zip');
          return { id, u, size: buf.length, url: await R2.presign(c, rd, { method: 'GET', key: C.KEYS.tmp(u), expires: UP_TTL }) };
        } catch (e) { return { id, err: String(e.message || e).slice(0, 30) }; }
      }));
      return res.status(200).json({ ok: true, items });
    }
    if (op === 'upPlan') return res.status(200).json(Object.assign({ ok: true }, await upPlan(deps, body)));
    if (op === 'upCommit') return res.status(200).json(Object.assign({ ok: true }, await upCommit(deps, body, ctx, rid)));
    if (op === 'catApply' || op === 'undo') {
      const r = await writeCat(deps, (cat) => (op === 'undo' ? C.undo(cat, body.v, ctx) : C.applyOps(cat, body.ops, ctx)), { rid });
      return res.status(200).json({ ok: true, v: r.v, n: r.n || 0, dup: !!r.dup, conflicts: r.conflicts || [], miss: r.miss || 0, skipped: r.skipped || [] });
    }
    return res.status(400).json({ ok: false, error: 'bad_params' });
  } catch (e) {
    const m = String(e && e.message || e);
    if (m === 'bad_op') return res.status(400).json({ ok: false, error: 'bad_op', at: e.at, why: e.why });
    if (['no_version', 'no_undo', 'later_all', 'shrink', 'too_big', 'busy'].includes(m)) return res.status(409).json({ ok: false, error: m });
    return res.status(502).json({ ok: false, error: /^r2_/.test(m) ? m.slice(0, 60) : 'cat_failed' });
  }
}

/* ס׳9: הניקוי היומי (lib/libgc.js) — מהקרון, אחרי הגיבוי. בלי קטלוג ב־R2 (עוד לא עברו) — לא נוגעים בכלום */
async function dailyGc(deps, now) {
  const c = r2c();
  if (!c) return { ok: false, stop: 'no_r2' };
  const rd = rdeps(deps);
  return GC.runGc({
    cat: async () => { const r = await R2.getCond(c, rd, C.KEYS.cat, CAT_MAX); return r.status === 200 ? C.normCatalog(JSON.parse(zlib.gunzipSync(r.buf).toString('utf8'))) : null; },
    list: (p) => R2.list(c, rd, p, 20000), del: (k) => R2.del(c, rd, k),
  }, now);
}
module.exports = { dailyGc, OPS, ADMIN_OPS, BIG_OPS, handle, _byReset: () => { byCat = null; }, compat, fmtFor, LEGACY_RE, loadCat, writeCat, adminView, _reset: () => { memo = null; byCat = null; } };
