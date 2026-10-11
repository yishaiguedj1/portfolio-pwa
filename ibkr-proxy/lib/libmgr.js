'use strict';
/* מנהל הספרייה (ס׳1, 11/10/2026) — הקטלוג של המדף המשותף ב־R2 ופעולות השרתון. api/library.js מעביר לכאן את ה־ops החדשים.
   הקטלוג: lib/v2/cat.json.gz (מקור האמת, רק השרתון כותב, תמיד בכתיבה מותנית If-Match → אין דריסה בין שני מכשירים),
   ומתוכו נגזרים בכל כתיבה: מבט הקורא lib/v2/pub.json.gz (רק מה שפורסם) וגרסה בארכיון lib/v2/arc/<v>.json.gz.
   במופע נשמר עותק בזיכרון עד 10 שנ׳ (MEMO_MS), ואחר כך קריאה מותנית (ETag) — "אין שינוי" לא עולה קריאה מלאה.
   הקבצים עצמם לא עוברים כאן: הטלפון מוריד ומעלה ישירות מ־R2 בקישורים חתומים. */
const zlib = require('zlib');
const R2 = require('./r2');
const C = require('./libcat');

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

const ADMIN_OPS = new Set(['adminCat', 'catApply', 'undo']);
const OPS = new Set(['cat', 'urls', ...ADMIN_OPS]);
const RID_RE = /^[A-Za-z0-9_-]{6,64}$/;

/* op מהטלפון (אחרי אימות + הרשאת קורא ב־api/library.js). admin = isAdmin(user) */
async function handle(op, body, user, admin, res, deps = {}) {
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
    if (op === 'catApply' || op === 'undo') {
      const rid = RID_RE.test(String(body.rid || '')) ? String(body.rid) : '';
      const ctx = { now: nowOf(deps), by: user.email || '' };
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

module.exports = { OPS, ADMIN_OPS, handle, loadCat, writeCat, adminView, _reset: () => { memo = null; } };
