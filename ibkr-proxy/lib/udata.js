'use strict';
/* 6/11/2026 — שלב 4 בתוכנית העצמאות מ־Firebase (תוכנית-עצמאות-מ-Firebase.md): התיק והספרייה דרך השרת שלנו.
   עד היום הטלפון קרא וכתב ישירות ב־Firestore את users/{uid} (Invest) ואת academyUsers/{uid} (Academy, השדה lib).
   עכשיו: POST /api/udata (רק בשרת — SERVER_ONLY ב־server.js; ב־Vercel אין, ושם הטלפון מקבל 404 וממשיך ל־Firestore).
   הקריאה — מהמסד שלנו (lib/ldb.js, מצב "דרך"); הכתיבה — ממשיכה מיד ל־Firestore עם אותה מסכת שדות שה־SDK היה שולח
   (set עם merge), ומשם חוזרת למסד. כך Firestore הוא תמיד עותק שלם, וכשהשרת לא זמין הטלפון כותב בו כמו קודם, ורושם
   ביומן snbChg (הכללים מתירים רק את הרשומה שלו) — לולאת האיחוד (lib/ldbsync.js) מביאה את המסמך כשהשרת חוזר.
   fb=1 (הטלפון כתב ישירות מאז הפעם הקודמת) — לפני הפעולה קוראים את המסמך מ־Firestore ומאחדים ("השינוי האחרון גובר").

   אבטחה (CLAUDE.md סעיף 3, "מערכות משלנו" — לא פחות מכללי Firestore, firestore/firestore.rules):
   - הזהות רק מטוקן Firebase שהשרת מאמת בעצמו (verifyIdToken, RS256); ה־uid לעולם לא מגוף הבקשה.
   - אפליקציה: המקור (Origin) והטענה app בטוקן — כמו appIs בכללים: users רק ל־invest, academyUsers רק ל־academy ('all' לשתיהן).
   - שדות: ב־users — לא admin/role/isAdmin/studio/vault; ב־academyUsers — רק lib (mv/dl של השרת, lib/libmove.js).
     מחיקת מסמך — רק users (כמו בכללים).
   - תקרות: גוף עד 1MB (המגבלה של מסמך ב־Firestore), עד 2,000 שדות בכתיבה, עומק 20, קצב לכל משתמש.
   - כבוי כברירת מחדל: מדליקים בדגל ud_srv במרכז הניהול (לכל סביבה בנפרד), או SNB_UDATA=on. כבוי / האוסף עוד לא במסד —
     503, והטלפון ממשיך ל־Firestore. */
const G = require('./gauth');
const { appForOrigin, sessEnv } = require('./session');
const { fsToJs, jsToFs } = require('./acmerge');

const COLS = {
  invest: { col: 'users', deny: ['admin', 'role', 'isAdmin', 'studio', 'vault'], canDel: true, stamp: 'updatedAt' },
  academy: { col: 'academyUsers', only: ['lib'] },
};
const MAX_BODY = 1024 * 1024;
const MAX_LEAVES = 2000, MAX_DEPTH = 20, MAX_SEG = 200, RATE_MIN = 120;
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';
const DOC = (col, uid) => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents/' + col + '/' + uid;

/* נתיב שדה של Firestore: מקטע שאינו מזהה פשוט — בגרשיים הפוכים (כמו ה־SDK) */
const seg = (s) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : '`' + s.replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`');
const fieldPath = (p) => p.map(seg).join('.');
const isMap = (v) => v && typeof v === 'object' && !Array.isArray(v);
/* העלים של אובייקט — מה ש־set(…, { merge: true }) של ה־SDK כותב (מפה ריקה, מערך וערך פשוט = עלה) */
function leaves(o, pre, out, depth) {
  if (depth > MAX_DEPTH) throw new Error('too_deep');
  for (const k of Object.keys(o)) {
    if (!k || k.length > MAX_SEG) throw new Error('bad_field');
    const v = o[k], p = pre.concat(k);
    if (isMap(v) && Object.keys(v).length) leaves(v, p, out, depth + 1);
    else out.push(p);
    if (out.length > MAX_LEAVES) throw new Error('too_many');
  }
  return out;
}
function depthOk(v, d) {
  if (d > MAX_DEPTH) return false;
  if (Array.isArray(v)) return v.every((x) => depthOk(x, d + 1));
  if (isMap(v)) return Object.values(v).every((x) => depthOk(x, d + 1));
  return typeof v !== 'number' || Number.isFinite(v);
}
/* השדה העליון מותר באוסף הזה (כמו הכללים) */
function topOk(spec, k) {
  if (spec.only) return spec.only.includes(k);
  return !(spec.deny || []).includes(k) && k !== '_mt' && k !== spec.stamp;
}
const tsMs = (s) => { const t = Date.parse(s || ''); return Number.isFinite(t) ? t : 0; };

const hits = new Map();
function limited(uid, now) {
  const arr = (hits.get(uid) || []).filter((t) => now - t < 60e3);
  arr.push(now);
  hits.set(uid, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > RATE_MIN;
}

function makeHandler(over = {}) {
  return async function handler(req, res) {
    const env = over.env || process.env;
    const deps = {
      fetch: over.fetch || ((u, i) => globalThis.fetch(u, i)),   // העטוף (המסד שלנו) — נקרא בזמן הבקשה
      now: over.now || Date.now,
      token: over.token || (() => G.datastoreToken(over.fetch)),
      verify: over.verify || ((t) => G.verifyIdToken(t, { fetch: over.fetch })),
      ldb: over.ldb || require('./ldbsync'),
      on: over.on || (() => require('./ldbchg').thruOn(env)),   // SNB_UDATA=on או הדגל ud_srv במרכז הניהול
    };
    const h = req.headers || {};
    const origin = String(h.origin || h.Origin || '');
    const oa = appForOrigin(origin, sessEnv(env));
    res.setHeader('Vary', 'Origin');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (oa) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (!oa) return res.status(403).json({ ok: false, error: 'forbidden_origin' });
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
    let body = req.body;
    if (typeof body === 'string') { if (body.length > MAX_BODY) return res.status(413).json({ ok: false, error: 'too_large' }); try { body = JSON.parse(body); } catch (e) { body = null; } }
    if (!isMap(body)) return res.status(400).json({ ok: false, error: 'bad_body' });
    let len = 0;
    try { len = JSON.stringify(body).length; } catch (e) { len = Infinity; }
    if (len > MAX_BODY) return res.status(413).json({ ok: false, error: 'too_large' });
    const spec = Object.prototype.hasOwnProperty.call(COLS, body.app) ? COLS[body.app] : null;
    if (!spec) return res.status(400).json({ ok: false, error: 'bad_app' });
    if (oa !== 'all' && oa !== body.app) return res.status(403).json({ ok: false, error: 'wrong_app' });
    if (!deps.on()) return res.status(503).json({ ok: false, error: 'off' });
    if (!deps.ldb.ready(spec.col)) return res.status(503).json({ ok: false, error: 'not_ready' });
    let u;
    try { u = await deps.verify(String(body.idToken || '')); } catch (e) { return res.status(401).json({ ok: false, error: 'bad_token' }); }
    const uid = u && u.uid;
    if (!UID_RE.test(String(uid || ''))) return res.status(401).json({ ok: false, error: 'bad_token' });
    if (u.app && u.app !== 'all' && u.app !== body.app) return res.status(403).json({ ok: false, error: 'wrong_app' });
    if (limited(uid, deps.now())) return res.status(429).json({ ok: false, error: 'rate' });
    const op = String(body.op || '');
    if (op !== 'get' && op !== 'put' && op !== 'del') return res.status(400).json({ ok: false, error: 'bad_op' });

    // הטלפון כתב ישירות ב־Firestore (השרת לא היה זמין) — קודם מאחדים את המסמך משם
    if (body.fb) { try { await deps.ldb.refresh(spec.col, uid); } catch (e) {} }
    const url = DOC(spec.col, uid);
    const auth = async () => ({ Authorization: 'Bearer ' + await deps.token() });

    if (op === 'get') {
      const r = await deps.fetch(url, { headers: await auth() });
      if (r.status === 404) return res.status(200).json({ ok: true, doc: null });
      if (r.status !== 200) return res.status(502).json({ ok: false, error: 'fs_' + r.status });
      const d = await r.json();
      const f = Object.assign({}, d.fields || {});
      delete f._mt;
      const doc = fsToJs({ mapValue: { fields: f } });
      const st = spec.stamp && f[spec.stamp] && f[spec.stamp].timestampValue;
      return res.status(200).json({ ok: true, doc, ut: tsMs(d.updateTime), at: st ? tsMs(st) : 0 });
    }

    if (op === 'del') {
      if (!spec.canDel) return res.status(403).json({ ok: false, error: 'forbidden' });
      const r = await deps.fetch(url, { method: 'DELETE', headers: await auth() });
      if (r.status !== 200 && r.status !== 404) return res.status(502).json({ ok: false, error: 'fs_' + r.status });
      return res.status(200).json({ ok: true });
    }

    // put: data = מה שהטלפון היה שולח ל־set(…, { merge: true }); del = נתיבים למחיקה (FieldValue.delete)
    const data = body.data == null ? {} : body.data;
    const dels = body.del == null ? [] : body.del;
    if (!isMap(data) || !Array.isArray(dels) || dels.length > 200) return res.status(400).json({ ok: false, error: 'bad_data' });
    let mask;
    try { mask = leaves(data, [], [], 1); } catch (e) { return res.status(400).json({ ok: false, error: e.message }); }
    for (const p of dels) {
      if (!Array.isArray(p) || !p.length || p.length > MAX_DEPTH || !p.every((s) => typeof s === 'string' && s && s.length <= MAX_SEG)) return res.status(400).json({ ok: false, error: 'bad_del' });
      mask.push(p);
    }
    if (!mask.length) return res.status(400).json({ ok: false, error: 'empty' });
    if (!mask.every((p) => topOk(spec, p[0]))) return res.status(403).json({ ok: false, error: 'forbidden_field' });
    if (!depthOk(data, 1)) return res.status(400).json({ ok: false, error: 'bad_value' });
    const fields = jsToFs(data).mapValue.fields;
    const paths = mask.map(fieldPath);
    if (spec.stamp) { fields[spec.stamp] = { timestampValue: new Date(deps.now()).toISOString() }; paths.push(spec.stamp); }
    const qs = [...new Set(paths)].map((p) => 'updateMask.fieldPaths=' + encodeURIComponent(p)).join('&');   // בלי mask: התשובה (המסמך המלא) היא מה שנכנס למסד (ldbsync learn)
    const r = await deps.fetch(url + '?' + qs, {
      method: 'PATCH', headers: Object.assign({ 'Content-Type': 'application/json' }, await auth()), body: JSON.stringify({ fields }),
    });
    if (r.status !== 200) return res.status(r.status === 400 ? 400 : 502).json({ ok: false, error: 'fs_' + r.status });
    return res.status(200).json({ ok: true });
  };
}

module.exports = makeHandler();
Object.assign(module.exports, { makeHandler, leaves, fieldPath, COLS, _reset: () => hits.clear() });
