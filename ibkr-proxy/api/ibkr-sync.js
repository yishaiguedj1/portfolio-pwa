/* סנכרון IBKR ברקע — גם כשהאפליקציה סגורה (בקשת המשתמש 04/10/2026, אחרי שבחר בכך במפורש).
   GET  (Vercel Cron, פעם ביום אחרי 14:00 שעון ישראל): לכל משתמש רשום — מושך מ־IBKR את מה שחסר מאז
        הנתונים שבטלפון ושומר את הדוח המפוענח מוצפן. אידמפוטנטי: לכל משתמש לכל היותר משיכה אחת ליום
        (גם אם מישהו מבחוץ קורא לכתובת), ותפיסת ריצה עם תנאי מוקדם (updateTime) נגד ריצות מקבילות.
   POST (מהאפליקציה, Origin מאושר + התחברות Google מאומתת בשרתון + משתמש מורשה):
        { op:'status' } · { op:'enable', token, queryId, have } · { op:'disable' }
        { op:'pull', have } → החלקים שמוכנים מאז have · { op:'ack', have } → מוחק מהענן את מה שכבר יובא
   אבטחה: ה־token וה־Query ID נשמרים רק מוצפנים (lib/vault.js, AES-256-GCM, מפתח שחי רק ב־Vercel),
   ולעולם לא חוזרים לטלפון; גם הדוחות מוצפנים ונמחקים אחרי הייבוא. מורשים: מנהל הספרייה או IBKR_SYNC_USERS.
   מסמך ב־Firestore: ibkrVault/{uid} — c (פרטי חיבור), a (מאיפה להמשיך), s (חלקים מוכנים): מוצפנים;
   run/ok/err (זמנים וקוד שגיאה קצר): גלויים, בלי שום נתון של התיק. */
const { guard, ibkrGetMulti, errorXml, statementEndpointFrom, parseXml, statementToJson, FLEX_SEND_PATH, FLEX_GET_PATH, IBKR_HOST, TOKEN_RE, QUERY_RE } = require('../lib/ibkr');
const { verifyIdToken, datastoreToken, isAdmin, emails } = require('../lib/gauth');
const vault = require('../lib/vault');
const D = require('../lib/ibkrdates');

const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';
const COL = () => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents/ibkrVault';
const UID_RE = /^[A-Za-z0-9]{6,128}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const BUDGET_MS = 52000;            // maxDuration 60
const sleepReal = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Firestore (REST, חשבון השירות) ---------- */
async function fs(deps, method, url, body) {
  const tk = await datastoreToken(deps.fetch);
  const r = await (deps.fetch || fetch)(url, { method, headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j };
}
const sv = (f, k) => ((f || {})[k] || {}).stringValue || '';
const iv = (f, k) => +(((f || {})[k] || {}).integerValue || 0);
function fields(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) out[k] = typeof v === 'number' ? { integerValue: String(Math.round(v)) } : { stringValue: String(v) };
  return out;
}
async function readDoc(deps, uid) {
  const r = await fs(deps, 'GET', COL() + '/' + uid);
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
  return { f: r.j.fields || {}, updateTime: r.j.updateTime };
}
async function patch(deps, uid, obj, updateTime) {
  const q = Object.keys(obj).map((k) => 'updateMask.fieldPaths=' + k);
  if (updateTime) q.push('currentDocument.updateTime=' + encodeURIComponent(updateTime));
  const r = await fs(deps, 'PATCH', COL() + '/' + uid + '?' + q.join('&'), { fields: fields(obj) });
  return r.status === 200;
}

/* ---------- רשומה מפוענחת ---------- */
const AAD = (uid, f) => uid + '|' + f;
function decode(uid, doc) {
  const c = vault.open(sv(doc.f, 'c'), AAD(uid, 'c'));
  const a = vault.open(sv(doc.f, 'a'), AAD(uid, 'a'));
  const s = vault.open(sv(doc.f, 's'), AAD(uid, 's')) || { chunks: [] };
  return { c, a, s, run: iv(doc.f, 'run'), ok: iv(doc.f, 'ok'), err: sv(doc.f, 'err'), updateTime: doc.updateTime };
}
const fromHave = (have) => ISO_RE.test(String(have || '')) ? D.nextYmd(have.replace(/-/g, '')) : '';
const liveChunks = (s, from) => (s.chunks || []).filter((x) => x.fd >= from);

/* ---------- משיכה מ־IBKR (שרת לשרת) ---------- */
async function flexChunk(creds, fd, td, deadline, deps) {
  const get = deps.ibkrGetMulti || ibkrGetMulti;
  const sleep = deps.sleep || sleepReal;
  const left = () => deadline - Date.now();
  const send = await get(`${FLEX_SEND_PATH}?t=${encodeURIComponent(creds.t)}&q=${encodeURIComponent(creds.q)}&v=3&fd=${fd}&td=${td}`, undefined, Math.min(24000, left()));
  if (send.status !== 200) return { err: 'ibkr_http_' + send.status };
  const e1 = errorXml(send.text);
  if (e1) return { err: 'flex_' + e1.code };
  const ref = (send.text.match(/<ReferenceCode>\s*([^<]+)\s*<\/ReferenceCode>/) || [])[1];
  const url = (send.text.match(/<Url>\s*([^<]+)\s*<\/Url>/i) || [])[1] || '';
  if (!ref) return { err: 'no_reference_code' };
  const ep = statementEndpointFrom(url.trim());
  const base = ep ? ep.base : IBKR_HOST, path = ep ? ep.path : FLEX_GET_PATH;
  await sleep(4000);                                   // IBKR מכין את הדוח — שאילתה מיידית רק שורפת מכסה
  while (left() > 6000) {
    const r = await get(`${path}?t=${encodeURIComponent(creds.t)}&q=${encodeURIComponent(ref.trim())}&v=3`, base, Math.min(15000, left() - 1000));
    if (r.status === 200) {
      const e = errorXml(r.text);
      if (e && e.code !== '1009' && e.code !== '1019') return { err: 'flex_' + e.code };
      if (!e && /<FlexStatement[\s>]/.test(r.text)) return { data: statementToJson(parseXml(r.text)) };
    }
    await sleep(6000);                                 // עד ~8 בקשות בדקה — בתוך מגבלת 10 לדקה של IBKR
  }
  return { err: 'timeout' };
}

async function runOne(uid, doc, now, deadline, deps) {
  const rec = decode(uid, doc);
  if (rec.run >= D.autoTargetMs(now)) return 'skip';             // כבר רץ בחלון הזה
  // תפיסת הריצה: רק מי שמצליח לכתוב מול אותה גרסת מסמך ממשיך (ריצה מקבילה / קריאה חוזרת — יוצאת)
  if (!(await patch(deps, uid, { run: now }, rec.updateTime))) return 'busy';
  if (!rec.c || !rec.a || !rec.a.from) { await patch(deps, uid, { err: 'bad_record' }); return 'bad'; }
  const from = rec.a.from, end = D.lastClosedYmd(now);
  const have = liveChunks(rec.s, from);
  if (!D.hasWeekday(from, end)) { await patch(deps, uid, { err: '', s: vault.seal({ chunks: have }, AAD(uid, 's')) }); return 'uptodate'; }
  const want = D.dateChunks(from, end);
  const key = (x) => x.fd + '|' + x.td;
  let chunks = have.slice(), err = '', got = 0;
  for (const w of want) {
    if (chunks.some((x) => key(x) === key(w))) continue;
    if (deadline - Date.now() < 20000) { err = 'timeout'; break; }
    const r = await flexChunk(rec.c, w.fd, w.td, deadline, deps);
    if (!r.data) { err = r.err; break; }                         // לא ממשיכים אחרי כשל — האפליקציה תשלים
    chunks = chunks.filter((x) => x.fd !== w.fd).concat([{ fd: w.fd, td: w.td, data: r.data }]);   // גרסה קצרה ישנה של אותו חלק — מוחלפת
    got++;
  }
  const upd = { s: vault.seal({ chunks }, AAD(uid, 's')), err: String(err).slice(0, 40) };
  if (got) upd.ok = Date.now();
  await patch(deps, uid, upd);
  return got ? 'ok' : (err || 'nothing');
}

async function cron(req, res, deps) {
  const secret = process.env.CRON_SECRET;
  if (secret && String(req.headers.authorization || '') !== 'Bearer ' + secret) return res.status(401).json({ ok: false });
  if (!vault.configured()) return res.status(503).json({ ok: false, error: 'not_configured' });
  const now = deps.now || Date.now(), deadline = Date.now() + BUDGET_MS;
  const list = await fs(deps, 'GET', COL() + '?pageSize=50');
  if (list.status !== 200) return res.status(502).json({ ok: false, error: 'fs_http_' + list.status });
  const out = {};
  for (const d of (list.j && list.j.documents) || []) {
    const uid = String(d.name || '').split('/').pop();
    if (!UID_RE.test(uid)) continue;
    try { out[uid.slice(0, 4)] = await runOne(uid, { f: d.fields || {}, updateTime: d.updateTime }, now, deadline, deps); }
    catch (e) { out[uid.slice(0, 4)] = 'error'; }
    if (deadline - Date.now() < 20000) break;
  }
  return res.status(200).json({ ok: true, runs: out });       // בלי נתונים — רק מצב
}

function allowed(user) {
  return !!(user && user.verified && (isAdmin(user) || emails(process.env.IBKR_SYNC_USERS).includes(user.email)));
}

async function handler(req, res, deps = {}) {
  if (req.method === 'GET') return cron(req, res, deps);
  if (guard(req, res)) return;
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  if (!vault.configured()) return res.status(503).json({ ok: false, error: 'not_configured' });
  let user;
  try { user = await verifyIdToken(body.idToken, deps.verify || {}); } catch (e) { return res.status(401).json({ ok: false, error: 'no_auth' }); }
  if (!UID_RE.test(user.uid)) return res.status(401).json({ ok: false, error: 'no_auth' });
  const ok = allowed(user);
  const uid = user.uid;
  try {
    if (body.op === 'status') {
      const doc = ok ? await readDoc(deps, uid) : null;
      return res.status(200).json({ ok: true, allowed: ok, enabled: !!doc, run: doc ? iv(doc.f, 'run') : 0, okAt: doc ? iv(doc.f, 'ok') : 0, err: doc ? sv(doc.f, 'err') : '' });
    }
    if (!ok) return res.status(403).json({ ok: false, error: 'not_allowed' });
    if (body.op === 'enable') {
      const t = String(body.token || '').trim(), q = String(body.queryId || '').trim(), from = fromHave(body.have);
      if (!TOKEN_RE.test(t) || !QUERY_RE.test(q) || !from) return res.status(400).json({ ok: false, error: 'bad_params' });
      const r = await fs(deps, 'PATCH', COL() + '/' + uid, { fields: fields({
        c: vault.seal({ t, q }, AAD(uid, 'c')), a: vault.seal({ from }, AAD(uid, 'a')), s: vault.seal({ chunks: [] }, AAD(uid, 's')),
        run: 0, ok: 0, err: '', v: 1 }) });
      if (r.status !== 200) return res.status(502).json({ ok: false, error: 'fs_http_' + r.status });
      return res.status(200).json({ ok: true, enabled: true });
    }
    if (body.op === 'disable') {
      const r = await fs(deps, 'DELETE', COL() + '/' + uid);
      return res.status(r.status === 200 || r.status === 404 ? 200 : 502).json({ ok: r.status === 200 || r.status === 404 });
    }
    if (body.op === 'pull' || body.op === 'ack') {
      const doc = await readDoc(deps, uid);
      if (!doc) return res.status(200).json({ ok: true, enabled: false, chunks: [] });
      const rec = decode(uid, doc);
      if (!rec.c || !rec.a) return res.status(200).json({ ok: true, enabled: false, chunks: [], err: 'bad_record' });
      const from = fromHave(body.have) || rec.a.from;
      const keep = liveChunks(rec.s, from);
      if (from !== rec.a.from || keep.length !== (rec.s.chunks || []).length) {
        // מה שכבר בטלפון — נמחק מהענן (מזעור נתונים); ריצה מקבילה של הקרון → נשאר לפעם הבאה
        await patch(deps, uid, { a: vault.seal({ from }, AAD(uid, 'a')), s: vault.seal({ chunks: keep }, AAD(uid, 's')) }, doc.updateTime);
      }
      return res.status(200).json({ ok: true, enabled: true, run: rec.run, okAt: rec.ok, err: rec.err,
        chunks: body.op === 'pull' ? keep.map((x) => ({ fd: x.fd, td: x.td, data: x.data })) : [] });
    }
    return res.status(400).json({ ok: false, error: 'bad_params' });
  } catch (e) {
    return res.status(502).json({ ok: false, error: /^(fs_http_|sa_http_|not_configured)/.test(String(e.message)) ? String(e.message).slice(0, 30) : 'failed' });
  }
}

module.exports = (req, res) => handler(req, res);
module.exports._handler = handler;
module.exports._flexChunk = flexChunk;
