'use strict';
/* מנהל הספרייה, ס׳1 (11/10/2026) — הקטלוג של המדף המשותף THE SNOWBALL. טהור: בלי רשת, בלי זמן מערכת (הזמן מגיע מבחוץ).
   הקטלוג (JSON אחד, נשמר דחוס ב־R2 ונכתב רק בשרתון בכתיבה מותנית) הוא מקור האמת לפרטי הספרים — הקובץ לא משתנה.
   מבנה: { schema:2, v, at, books:{ id → ספר }, hist:[…], rids:{ מזהה בקשה → v } }
   ספר: id (המזהה המקומי בטלפון: 'id-'+dc:identifier — מפתח ההתקדמות של הקוראים, אסור לשנות),
        12 השדות של EDIT_FIELDS בטלפון (מחרוזות, אותם שמות — כך הטלפון מחיל אותם כמו עריכה רגילה),
        st (pub/draft/hide), del (ms — בסל המחזור), files [{fmt, md5, size, at}] (הראשון = לקריאה), prev (קבצים שהוחלפו),
        cover {h, r, bg, at}, lock [שדות שמשיכת פרטים לא דורסת], prov {שדה → מקור}, mt {שדה → מתי},
        legacy {driveId} (מהמעבר מ־Drive), to (מוזג לתוך), note, batch, added, updated.
   כל פעולה נרשמת ב־hist עם הערכים הקודמים (inv) — "ביטול" מחזיר אותם, חוץ מספרים ששונו אחר כך. */

const FIELDS = ['title', 'subtitle', 'author', 'authorSort', 'pub', 'date', 'lang', 'series', 'seriesIdx', 'isbn', 'tags', 'desc'];   // = EDIT_FIELDS ב־library.js (הבדיקה משווה)
const FMAX = { title: 300, subtitle: 300, author: 300, authorSort: 200, pub: 200, date: 10, lang: 12, series: 200, seriesIdx: 12, isbn: 40, tags: 600, desc: 6000 };
const FMTS = ['epub', 'azw3', 'mobi', 'fb2'];
const STATES = ['pub', 'draft', 'hide'];
const SOURCES = ['file', 'user', 'nli', 'google', 'ol', 'apple', 'wd', 'hc', 'rule', 'drive'];
const SCHEMA = 2;
const HIST_MAX = 200;          // גרסאות ביומן
const INV_KEEP = 40;           // לכמה גרסאות אחרונות נשמרים הערכים הקודמים (ביטול)
const INV_MAX = 96 * 1024;     // ערכים קודמים של פעולה אחת — מעבר לזה אין ביטול לפעולה (יש עדיין הארכיון)
const RIDS_MAX = 300;
const IDS_MAX = 1000;
const TAGS_MAX = 30, TAG_MAX = 60;
const MAX_BOOK = 200 * 1024 * 1024;
const MD5_RE = /^[0-9a-f]{32}$/;
const HASH_RE = /^[0-9a-f]{16,64}$/;
const DRIVE_RE = /^[A-Za-z0-9_-]{10,100}$/;
const BATCH_RE = /^[A-Za-z0-9_-]{4,40}$/;
const BAD_IDS = new Set(['__proto__', 'constructor', 'prototype']);
const CTL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;        // תווי בקרה (שורה חדשה נשארת רק בתקציר)
const BIDI = /[‪-‮⁦-⁩]/g;                         // סימני כיווניות שמשבשים תצוגה

const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
const posInt = (x) => (Number.isFinite(+x) && +x > 0 ? Math.floor(+x) : 0);
const idOk = (id) => typeof id === 'string' && id.length >= 3 && id.length <= 300 && !/[\u0000-\u001f\u007f]/.test(id) && !BAD_IDS.has(id);

/* תגיות: מחרוזת מופרדת בפסיקים (כמו בטלפון) ↔ מערך, בלי כפולים ובלי ריקים */
function tagList(s) {
  const out = [], seen = new Set();
  for (const t of String(s || '').split(/[,،;]/)) {
    const v = t.replace(CTL, '').replace(BIDI, '').replace(/\s+/g, ' ').trim().slice(0, TAG_MAX);
    const k = v.toLowerCase();
    if (v && !seen.has(k)) { seen.add(k); out.push(v); }
    if (out.length >= TAGS_MAX) break;
  }
  return out;
}
const tagStr = (a) => (Array.isArray(a) ? a : tagList(a)).join(', ');

/* שדה אחד: מחרוזת נקייה, או '' (= אין ערך) */
function normField(k, v) {
  if (v == null) return '';
  let s = String(v);
  if (k === 'desc') s = s.replace(/<[^>]*>/g, ' ').replace(CTL, '').replace(BIDI, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  else s = s.replace(CTL, ' ').replace(BIDI, '').replace(/\s+/g, ' ').trim();
  if (k === 'date') { const m = s.match(/^(\d{4})(-\d{2}(-\d{2})?)?$/); return m ? s : ''; }
  if (k === 'lang') return /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(s) ? s : '';
  if (k === 'seriesIdx') return /^\d{1,5}(\.\d{1,3})?$/.test(s) ? s.replace(/^0+(?=\d)/, '') : '';
  if (k === 'isbn') return s.replace(/[^0-9Xx\- ]/g, '').trim().slice(0, FMAX.isbn);
  if (k === 'tags') return tagStr(tagList(s));
  return s.slice(0, FMAX[k] || 300);
}

function normFile(f) {
  if (!f || typeof f !== 'object') return null;
  const fmt = FMTS.includes(f.fmt) ? f.fmt : '';
  const md5 = String(f.md5 || '').toLowerCase();
  const size = posInt(f.size);
  if (!fmt || !MD5_RE.test(md5) || !size || size > MAX_BOOK) return null;
  return { fmt, md5, size, at: posInt(f.at) };
}
function normCover(c) {
  if (!c || typeof c !== 'object' || !HASH_RE.test(String(c.h || ''))) return null;
  const r = Number(c.r);
  return { h: String(c.h), r: Number.isFinite(r) && r >= 0.3 && r <= 2 ? Math.round(r * 1000) / 1000 : 0.667,
    bg: /^#[0-9a-f]{6}$/i.test(String(c.bg || '')) ? String(c.bg).toLowerCase() : '', at: posInt(c.at) };
}

/* ספר מהקטלוג (או מבקשה): רק השדות המותרים, בצורה הנכונה. null = לא תקין */
function normBook(b) {
  if (!b || typeof b !== 'object' || !idOk(b.id)) return null;
  const o = { id: b.id, st: STATES.includes(b.st) ? b.st : 'draft' };
  if (posInt(b.del)) o.del = posInt(b.del);
  for (const k of FIELDS) { const v = normField(k, b[k]); if (v) o[k] = v; }
  const files = (Array.isArray(b.files) ? b.files : []).map(normFile).filter(Boolean).slice(0, 3);
  if (files.length) o.files = files;
  const prev = (Array.isArray(b.prev) ? b.prev : []).map(normFile).filter(Boolean).slice(0, 3);
  if (prev.length) o.prev = prev;
  const cv = normCover(b.cover);
  if (cv) o.cover = cv;
  const lock = (Array.isArray(b.lock) ? b.lock : []).filter((k) => FIELDS.includes(k) || k === 'cover');
  if (lock.length) o.lock = [...new Set(lock)];
  if (b.prov && typeof b.prov === 'object') {
    const p = {};
    for (const k of Object.keys(b.prov)) if ((FIELDS.includes(k) || k === 'cover') && SOURCES.includes(b.prov[k])) p[k] = b.prov[k];
    if (Object.keys(p).length) o.prov = p;
  }
  if (b.mt && typeof b.mt === 'object') {
    const m = {};
    for (const k of Object.keys(b.mt)) if ((FIELDS.includes(k) || k === 'cover') && posInt(b.mt[k])) m[k] = posInt(b.mt[k]);
    if (Object.keys(m).length) o.mt = m;
  }
  if (b.legacy && DRIVE_RE.test(String(b.legacy.driveId || ''))) o.legacy = { driveId: String(b.legacy.driveId) };
  if (idOk(b.to) && b.to !== b.id) o.to = b.to;
  const note = normField('subtitle', b.note).slice(0, 500);
  if (note) o.note = note;
  if (BATCH_RE.test(String(b.batch || ''))) o.batch = String(b.batch);
  o.added = posInt(b.added);
  o.updated = posInt(b.updated) || o.added;
  return o;
}

function emptyCatalog() { return { schema: SCHEMA, v: 0, at: 0, books: {}, hist: [], rids: {} }; }

/* הקטלוג כולו — כל ספר עובר normBook; ספר לא תקין נזרק (לא מפיל את הקטלוג) */
function normCatalog(c) {
  const out = emptyCatalog();
  if (!c || typeof c !== 'object') return out;
  out.v = posInt(c.v); out.at = posInt(c.at);
  const books = Object.create(null);
  const src = c.books && typeof c.books === 'object' ? c.books : {};
  for (const id of Object.keys(src)) {
    const b = normBook(Object.assign({}, src[id], { id }));
    if (b) books[id] = b;
  }
  out.books = books;
  out.hist = (Array.isArray(c.hist) ? c.hist : []).filter((h) => h && posInt(h.v)).slice(-HIST_MAX).map((h) => ({
    v: posInt(h.v), at: posInt(h.at), by: String(h.by || '').slice(0, 120), k: String(h.k || '').slice(0, 20),
    ids: Array.isArray(h.ids) ? h.ids.filter(idOk).slice(0, IDS_MAX) : [], all: h.all ? 1 : 0, n: posInt(h.n),
    f: Array.isArray(h.f) ? h.f.filter((x) => typeof x === 'string').slice(0, 30) : [],
    inv: h.inv && typeof h.inv === 'object' ? h.inv : null }));
  const rids = {};
  for (const k of Object.keys(c.rids && typeof c.rids === 'object' ? c.rids : {}).slice(-RIDS_MAX)) if (/^[A-Za-z0-9_-]{6,64}$/.test(k)) rids[k] = posInt(c.rids[k]);
  out.rids = rids;
  if (c.cfg && typeof c.cfg === 'object') { out.cfg = { source: c.cfg.source === 'r2' ? 'r2' : 'drive' }; if (posInt(c.cfg.at)) out.cfg.at = posInt(c.cfg.at); }   // at = מתי המקור הוחלף (ס׳9: ניקוי המראה הישנה אחרי 30 יום)
  return out;
}

/* נראה לקוראים: פורסם, לא בסל, ויש לו קובץ */
const visible = (b) => !!(b && b.st === 'pub' && !b.del && b.files && b.files.length);
const PUB_KEYS = FIELDS.concat(['added', 'updated']);
function pubBook(b) {
  const o = { id: b.id };
  for (const k of PUB_KEYS) if (b[k] !== undefined && b[k] !== '') o[k] = b[k];
  o.files = b.files.map((f) => ({ fmt: f.fmt, md5: f.md5, size: f.size }));
  if (b.cover) o.cover = { h: b.cover.h, r: b.cover.r, bg: b.cover.bg };
  return o;
}
/* מבט הקורא: רק מה שפורסם, בלי טיוטות, סל, יומן, מקורות ונעילות */
function pubView(cat) {
  const books = {};
  for (const id of Object.keys(cat.books)) if (visible(cat.books[id])) books[id] = pubBook(cat.books[id]);
  return { schema: SCHEMA, v: cat.v, at: cat.at, books };
}
/* מה השתנה לקורא מאז גרסה have: {same} / {up, rm} / null (= צריך תמונה מלאה) */
function delta(cat, have, maxN = 300) {
  have = Number(have);
  if (!Number.isInteger(have) || have < 0 || have > cat.v) return null;
  if (have === cat.v) return { same: true };
  const hs = cat.hist.filter((h) => h.v > have);
  if (!hs.length || hs[0].v !== have + 1 || hs.some((h) => h.all)) return null;
  const ids = new Set();
  for (const h of hs) for (const id of h.ids) ids.add(id);
  if (ids.size > maxN) return null;
  const up = [], rm = [];
  for (const id of ids) {
    const b = cat.books[id];
    if (visible(b)) up.push(pubBook(b));
    else rm.push(b && b.to ? { id, to: b.to } : { id });
  }
  return { up, rm };
}

/* ---------------------------------------------------------------- פעולות */
function opErr(i, why) { const e = new Error('bad_op'); e.at = i; e.why = why; return e; }
const idsOf = (x) => (Array.isArray(x) ? [...new Set(x.filter(idOk))].slice(0, IDS_MAX) : []);

/* מחיל רשימת פעולות על עותק של הקטלוג. ctx = { now, by, internal } — internal = השרתון עצמו (הוספה אחרי אימות קובץ,
   קובץ חדש, כריכה): לא מגיע כמו שהוא מהטלפון. מחזיר { cat, n, ids, fields, conflicts, miss, kind } */
function applyOps(cat0, ops, ctx) {
  if (!Array.isArray(ops) || !ops.length || ops.length > 50) throw opErr(-1, 'ops');
  const cat = clone(cat0);
  cat.books = Object.assign(Object.create(null), cat.books);
  const now = posInt(ctx && ctx.now) || 1;
  const inv = Object.create(null), touched = new Set(), fields = new Set(), conflicts = [];
  let miss = 0, all = false, meta = false;
  const rec = (id, k) => {
    const b = cat.books[id];
    if (!inv[id]) inv[id] = Object.create(null);
    if (!(k in inv[id])) inv[id][k] = b && b[k] !== undefined ? clone(b[k]) : null;
  };
  const put = (id, k, v) => {
    const b = cat.books[id];
    const empty = v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
    if (empty ? b[k] === undefined : same(b[k], v)) return false;
    rec(id, k);
    if (empty) delete b[k]; else b[k] = v;
    touched.add(id); fields.add(k);
    return true;
  };
  const touch = (id) => { if (touched.has(id)) put(id, 'updated', now); };
  /* שדה של ספר מעריכה: נרמול, מקור, מתי, ונעילה (שדה שנערך ביד — משיכת פרטים לא תדרוס אותו) */
  const setField = (id, k, raw, src, lock) => {
    const b = cat.books[id];
    const v = normField(k, raw);
    if (!put(id, k, v)) return false;
    const mt = Object.assign({}, b.mt || {}); mt[k] = now; put(id, 'mt', mt);
    const prov = Object.assign({}, b.prov || {});
    if (v) prov[k] = SOURCES.includes(src) ? src : 'user'; else delete prov[k];
    put(id, 'prov', prov);
    if (lock && v) { const l = new Set(b.lock || []); if (!l.has(k)) { l.add(k); put(id, 'lock', [...l]); } }
    return true;
  };
  const get = (id) => { const b = cat.books[id]; if (!b) miss++; return b; };

  ops.forEach((op, i) => {
    if (!op || typeof op !== 'object') throw opErr(i, 'shape');
    switch (op.op) {
      case 'set': {
        const b = get(op.id); if (!b) return;
        const f = op.f && typeof op.f === 'object' ? op.f : {};
        const keys = Object.keys(f).filter((k) => FIELDS.includes(k));
        if (!keys.length) throw opErr(i, 'fields');
        const src = SOURCES.includes(op.src) ? op.src : 'user';
        for (const k of keys) {
          if (op.pv && Object.prototype.hasOwnProperty.call(op.pv, k)) {   // התנגשות: ערך שהשתנה ממכשיר אחר מאז שהטלפון ראה אותו
            const seen = normField(k, op.pv[k]), cur = b[k] || '', next = normField(k, f[k]);
            if (cur !== seen && cur !== next) conflicts.push({ id: b.id, f: k, theirs: cur, mine: next });
          }
          setField(b.id, k, f[k], src, src === 'user' && op.lock !== false);
        }
        touch(b.id);
        return;
      }
      case 'bulk': {
        const ids = idsOf(op.ids); if (!ids.length) throw opErr(i, 'ids');
        const f = op.f && typeof op.f === 'object' ? op.f : {};
        const keys = Object.keys(f).filter((k) => FIELDS.includes(k) && k !== 'title' && k !== 'isbn');   // לפי ת־קורא: כותר ו־ISBN לא במרובה
        const clear = (Array.isArray(op.clear) ? op.clear : []).filter((k) => FIELDS.includes(k) && k !== 'title');
        const add = tagList((op.tagsAdd || []).join(',')), rm = new Set(tagList((op.tagsRm || []).join(',')).map((t) => t.toLowerCase()));
        const num = op.num && typeof op.num === 'object' ? { start: Number(op.num.start), step: Number(op.num.step || 1) } : null;
        if (num && !(Number.isFinite(num.start) && num.start >= 0 && num.start < 100000 && Number.isFinite(num.step) && num.step > 0 && num.step <= 1000)) throw opErr(i, 'num');
        if (!keys.length && !clear.length && !add.length && !rm.size && !num) throw opErr(i, 'empty');
        ids.forEach((id, j) => {
          const b = get(id); if (!b) return;
          for (const k of keys) setField(id, k, f[k], 'user', true);
          for (const k of clear) setField(id, k, '', 'user', false);
          if (add.length || rm.size) {
            const cur = tagList(b.tags || '').filter((t) => !rm.has(t.toLowerCase()));
            const lower = new Set(cur.map((t) => t.toLowerCase()));
            for (const t of add) if (!lower.has(t.toLowerCase())) cur.push(t);
            setField(id, 'tags', tagStr(cur), 'user', true);
          }
          if (num) {
            const n = Math.round((num.start + j * num.step) * 1000) / 1000;
            setField(id, 'seriesIdx', String(n), 'user', true);
          }
          touch(id);
        });
        return;
      }
      case 'state': {
        if (!STATES.includes(op.st)) throw opErr(i, 'st');
        for (const id of idsOf(op.ids)) { const b = get(id); if (b && put(id, 'st', op.st)) touch(id); }
        return;
      }
      case 'del': case 'restore': {
        for (const id of idsOf(op.ids)) {
          const b = get(id); if (!b) continue;
          if (op.op === 'del' ? put(id, 'del', now) : put(id, 'del', null)) touch(id);
          if (op.op === 'restore' && b.to) put(id, 'to', '');
        }
        return;
      }
      case 'purge': {   // מחיקה לצמיתות — רק מה שכבר בסל המחזור
        for (const id of idsOf(op.ids)) {
          const b = get(id); if (!b || !b.del) continue;
          if (!inv[id]) inv[id] = Object.create(null);
          inv[id]._book = clone(b);
          delete cat.books[id]; touched.add(id); fields.add('purge');
        }
        return;
      }
      case 'lock': {
        const fl = (Array.isArray(op.f) ? op.f : FIELDS.concat('cover')).filter((k) => FIELDS.includes(k) || k === 'cover');
        for (const id of idsOf(op.ids)) {
          const b = get(id); if (!b) continue;
          const l = new Set(b.lock || []);
          for (const k of fl) { if (op.on === false) l.delete(k); else l.add(k); }
          put(id, 'lock', FIELDS.concat('cover').filter((k) => l.has(k)));
        }
        return;
      }
      case 'rename': {   // מחבר / סדרה / הוצאה / תגית — בכל הספרייה (שם קיים = מיזוג)
        const k = op.k, nf = (v) => (k === 'tag' ? (tagList(String(v || '').replace(/[,،;]/g, ' '))[0] || '') : normField(k, v));
        const from = nf(op.from), to = nf(op.to);
        if (!['author', 'series', 'pub', 'tag'].includes(k) || !from || from === to) throw opErr(i, 'rename');
        all = true;
        for (const id of Object.keys(cat.books)) {
          const b = cat.books[id];
          if (k === 'tag') {
            const cur = tagList(b.tags || '');
            if (!cur.some((t) => t.toLowerCase() === from.toLowerCase())) continue;
            const next = []; const seen = new Set();
            for (const t of cur) { const v = t.toLowerCase() === from.toLowerCase() ? to : t; if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); next.push(v); } }
            setField(id, 'tags', tagStr(next), 'user', true); touch(id);
          } else if ((b[k] || '').toLowerCase() === from.toLowerCase()) { setField(id, k, to, 'user', true); touch(id); }
        }
        return;
      }
      case 'merge': {   // שני ספרים לאחד: נשמר keep (המזהה שלו = ההתקדמות), drop עובר לסל עם הפניה
        const keep = get(op.keep), drop = get(op.drop);
        if (!keep || !drop) return;
        if (keep.id === drop.id) throw opErr(i, 'merge');
        for (const k of FIELDS) if (!keep[k] && drop[k]) setField(keep.id, k, drop[k], (drop.prov && drop.prov[k]) || 'user', false);
        if ((!keep.files || !keep.files.length) && drop.files && drop.files.length) put(keep.id, 'files', clone(drop.files));
        if (!keep.cover && drop.cover) put(keep.id, 'cover', clone(drop.cover));
        put(drop.id, 'del', now); put(drop.id, 'to', keep.id);
        touch(keep.id); touch(drop.id);
        return;
      }
      case 'note': {
        const b = get(op.id); if (!b) return;
        if (put(b.id, 'note', normField('subtitle', op.text).slice(0, 500))) touch(b.id);
        return;
      }
      /* ---- פנימיות: רק מהשרתון, אחרי אימות של הקובץ / הכריכה ---- */
      case 'add': {
        if (!ctx.internal) throw opErr(i, 'internal');
        const nb = normBook(Object.assign({}, op.book, { added: now, updated: now }));
        if (!nb || cat.books[nb.id]) throw opErr(i, nb ? 'exists' : 'book');
        cat.books[nb.id] = nb;
        inv[nb.id] = Object.assign(Object.create(null), { _new: 1 });
        touched.add(nb.id); fields.add('add');
        return;
      }
      case 'file': {   // קובץ חדש לספר קיים (גרסה מתוקנת): הקודם נשמר ב־prev לביטול
        if (!ctx.internal) throw opErr(i, 'internal');
        const b = get(op.id); const f = normFile(op.file);
        if (!b || !f) return;
        const files = (b.files || []).filter((x) => x.fmt !== f.fmt);
        const old = (b.files || []).find((x) => x.fmt === f.fmt);
        if (old && old.md5 === f.md5) return;
        if (old) put(b.id, 'prev', [old].concat(b.prev || []).slice(0, 3));
        put(b.id, 'files', [f].concat(files).slice(0, 3));
        touch(b.id);
        return;
      }
      case 'cover': {
        if (!ctx.internal) throw opErr(i, 'internal');
        const b = get(op.id); if (!b) return;
        const cv = op.cover ? normCover(Object.assign({}, op.cover, { at: now })) : null;
        if (op.cover && !cv) throw opErr(i, 'cover');
        if (put(b.id, 'cover', cv)) {
          const mt = Object.assign({}, b.mt || {}); mt.cover = now; put(b.id, 'mt', mt);
          if (op.src) { const prov = Object.assign({}, b.prov || {}); if (SOURCES.includes(op.src)) prov.cover = op.src; put(b.id, 'prov', prov); }
          touch(b.id);
        }
        return;
      }
      case 'cfg': {   // ס׳2: מקור המדף (drive → r2 בסוף המעבר). שינוי בכל הספרייה — הקוראים מקבלים תמונה מלאה
        if (!ctx.internal) throw opErr(i, 'internal');
        const source = op.source === 'r2' ? 'r2' : 'drive';
        if (((cat.cfg && cat.cfg.source) || 'drive') === source) return;
        cat.cfg = Object.assign({}, cat.cfg || {}, { source, at: now });
        meta = true; all = true; fields.add('cfg');
        return;
      }
      default: throw opErr(i, 'unknown');
    }
  });
  return finish(cat, cat0, { inv, touched, fields, conflicts, miss, all, meta, kind: ops.every((o) => o && o.op === ops[0].op) ? ops[0].op : 'multi' }, ctx);
}

/* גרסה חדשה + רשומה ביומן (עם הערכים הקודמים לביטול, אם לא גדולים מדי) */
function finish(cat, cat0, r, ctx) {
  const now = posInt(ctx && ctx.now) || 1;
  if (!r.touched.size && !r.meta) return { cat: cat0, n: 0, ids: [], fields: [], conflicts: r.conflicts, miss: r.miss, kind: r.kind };
  cat.v = (cat0.v || 0) + 1; cat.at = now;
  let inv = r.inv;
  try { if (JSON.stringify(inv).length > INV_MAX) inv = null; } catch (e) { inv = null; }
  const ids = [...r.touched];
  cat.hist = (cat.hist || []).concat([{ v: cat.v, at: now, by: String((ctx && ctx.by) || '').slice(0, 120), k: r.kind,
    ids: ids.slice(0, IDS_MAX), all: r.all || ids.length > IDS_MAX ? 1 : 0, n: ids.length, f: [...r.fields].slice(0, 30), inv }]).slice(-HIST_MAX);
  const keepFrom = cat.hist.length - INV_KEEP;
  cat.hist.forEach((h, i) => { if (i < keepFrom) h.inv = null; });
  return { cat, n: ids.length || (r.meta ? 1 : 0), ids, fields: [...r.fields], conflicts: r.conflicts, miss: r.miss, kind: r.kind };
}

/* ביטול גרסה v: מחזיר את הערכים הקודמים — רק בספרים שלא השתנו אחריה (השאר מדווחים כדולגו). גם הביטול הוא גרסה (אפשר לבטל אותו) */
function undo(cat0, v, ctx) {
  const h = (cat0.hist || []).find((x) => x.v === Number(v));
  if (!h) { const e = new Error('no_version'); throw e; }
  if (!h.inv) { const e = new Error('no_undo'); throw e; }
  const later = new Set();
  for (const x of cat0.hist) if (x.v > h.v) { if (x.all) { const e = new Error('later_all'); throw e; } x.ids.forEach((id) => later.add(id)); }
  const cat = clone(cat0);
  cat.books = Object.assign(Object.create(null), cat.books);
  const inv = Object.create(null), touched = new Set(), fields = new Set(), skipped = [];
  for (const id of Object.keys(h.inv)) {
    if (later.has(id)) { skipped.push(id); continue; }
    const p = h.inv[id];
    inv[id] = Object.create(null);
    if (p._new) { if (cat.books[id]) { inv[id]._book = clone(cat.books[id]); delete cat.books[id]; touched.add(id); fields.add('add'); } continue; }
    if (p._book) { if (!cat.books[id]) { cat.books[id] = normBook(p._book); inv[id]._new = 1; touched.add(id); fields.add('purge'); } continue; }
    const b = cat.books[id];
    if (!b) { skipped.push(id); continue; }
    for (const k of Object.keys(p)) {
      inv[id][k] = b[k] === undefined ? null : clone(b[k]);
      if (p[k] == null) delete b[k]; else b[k] = clone(p[k]);
      touched.add(id); fields.add(k);
    }
    const nb = normBook(b); if (nb) cat.books[id] = nb;
  }
  const res = finish(cat, cat0, { inv, touched, fields, conflicts: [], miss: 0, all: false, kind: 'undo' }, ctx);
  res.skipped = skipped;
  return res;
}

/* --------------------------------------------- זיהוי סוג הקובץ לפי התוכן (64KB ראשונים) — לא לפי הסיומת */
function sniff(buf) {
  if (!buf || buf.length < 8) return '';
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    const head = b.subarray(0, Math.min(b.length, 65536)).toString('latin1');
    if (head.slice(30, 38) === 'mimetype' && head.slice(38, 58) === 'application/epub+zip') return 'epub';
    return head.includes('META-INF/') || head.includes('application/epub+zip') ? 'epub' : 'zip';
  }
  if (b.length >= 68 && b.subarray(60, 68).toString('latin1') === 'BOOKMOBI') return 'mobi';   // MOBI ו־AZW3 (KF8) — אותה מעטפת PalmDB
  const t = b.subarray(0, Math.min(b.length, 4096)).toString('utf8').replace(/^﻿/, '');
  if (/^\s*<\?xml/.test(t) && t.includes('<FictionBook')) return 'fb2';
  if (b.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  return '';
}
/* הסיומת שהטלפון הצהיר מתאימה לתוכן? (azw3 ו־mobi — אותה משפחה) */
function fmtMatches(fmt, sniffed) {
  if (fmt === 'epub') return sniffed === 'epub';
  if (fmt === 'azw3' || fmt === 'mobi') return sniffed === 'mobi';
  if (fmt === 'fb2') return sniffed === 'fb2';
  return false;
}

/* מפתחות R2 (נבנים רק בשרתון — לעולם לא ממה שהטלפון שלח) */
const KEYS = {
  cat: 'lib/v2/cat.json.gz',
  pub: 'lib/v2/pub.json.gz',
  arc: (v) => 'lib/v2/arc/' + String(posInt(v)).padStart(9, '0') + '.json.gz',
  file: (f) => (f && MD5_RE.test(f.md5) && FMTS.includes(f.fmt) ? 'lib/v2/f/' + f.md5 + '.' + f.fmt : ''),
  cover: (h) => (HASH_RE.test(String(h || '')) ? 'lib/v2/c/' + h + '.jpg' : ''),
  tmp: (u) => (/^[A-Za-z0-9]{20,40}$/.test(String(u || '')) ? 'lib/v2/in/' + u : ''),
};

module.exports = { FIELDS, FMAX, FMTS, STATES, SOURCES, SCHEMA, HIST_MAX, INV_KEEP, IDS_MAX, MD5_RE, HASH_RE, KEYS,
  idOk, tagList, tagStr, normField, normFile, normCover, normBook, emptyCatalog, normCatalog,
  visible, pubBook, pubView, delta, applyOps, undo, sniff, fmtMatches };
