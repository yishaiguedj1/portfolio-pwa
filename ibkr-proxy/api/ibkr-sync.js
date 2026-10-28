/* סנכרון IBKR ברקע — גם כשהאפליקציה סגורה (בקשת המשתמש 04/10/2026, אחרי שבחר בכך במפורש).
   GET  (Vercel Cron, פעם ביום אחרי 14:00 שעון ישראל): לכל משתמש רשום — מושך מ־IBKR את מה שחסר מאז
        הנתונים שבטלפון ושומר את הדוח המפוענח מוצפן. אידמפוטנטי: לכל משתמש לכל היותר משיכה אחת ליום
        (גם אם מישהו מבחוץ קורא לכתובת), ותפיסת ריצה עם תנאי מוקדם (updateTime) נגד ריצות מקבילות.
   POST (מהאפליקציה, Origin מאושר + התחברות Google מאומתת בשרתון + משתמש מורשה):
        { op:'status' } · { op:'enable', token, queryId, have } · { op:'disable' }
        { op:'pull', have } → החלקים שמוכנים מאז have · { op:'ack', have } → מוחק מהענן את מה שכבר יובא
        { op:'pxa', act } → התראות המחיר של גרף הנרות ברקע (27/10/2026 — לכל משתמש מחובר; ראו lib/pxalert.js)
        { op:'gwLive' } → IB Gateway (שלב 1 במחקר המסחר, 28/10/2026): מצב הסשן, אחזקות, יתרות ופקודות פתוחות חיות.
        SERVER_ONLY — רק בחדר האפליקציה (שם הסוקט ל־Gateway); ב־Vercel ‏421 והטלפון נשאר עם Flex. בזיכרון בלבד (lib/ibgw.js)
   GET ?job=px — הבודק של התראות המחיר (כל 5 שנ׳ מהשרת שלנו, server.js — startPx); גם מתחזק את החיבור ל־Gateway
   אבטחה: ה־token וה־Query ID נשמרים רק מוצפנים (lib/vault.js, AES-256-GCM, מפתח שחי רק ב־Vercel),
   ולעולם לא חוזרים לטלפון; גם הדוחות מוצפנים ונמחקים אחרי הייבוא. מורשים: מנהל הספרייה או IBKR_SYNC_USERS.
   מסמך ב־Firestore: ibkrVault/{uid} — c (פרטי חיבור), a (מאיפה להמשיך), s (חלקים מוכנים): מוצפנים;
   run/ok/err (זמנים וקוד שגיאה קצר): גלויים, בלי שום נתון של התיק. */
const { guard, ibkrGetMulti, errorXml, statementEndpointFrom, parseXml, statementToJson, FLEX_SEND_PATH, FLEX_GET_PATH, IBKR_HOST, TOKEN_RE, QUERY_RE } = require('../lib/ibkr');
const { verifyIdToken, datastoreToken, isAdmin, emails, hasEmail } = require('../lib/gauth');
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

/* ---------- התראות מחיר ברקע (27/10/2026, lib/pxalert.js) ---------- */
const PXA = require('../lib/pxalert');
const W = require('../lib/webpush');
const DOCS = () => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents/';
const PX_COL = () => DOCS() + 'pxAlerts';
const PX_LIST_MS = 10 * 60e3;       // מכסת Firestore: הרשימה כולה נקראת לכל היותר פעם ב־10 דק׳; שינוי מהטלפון מעדכן את הזיכרון מיד
const PX = { at: 0, users: new Map(), last: new Map(), busy: false, vapid: null, hits: new Map() };
const jp = (t, d) => { try { const v = JSON.parse(t || ''); return v == null ? d : v; } catch (e) { return d; } };
function pxUser(uid, f) {
  const a = PXA.norm(jp(sv(f, 'a'), []));
  return { uid, a, f: PXA.pruneFired(jp(sv(f, 'f'), {}), a), w: W.normSubs(jp(sv(f, 'w'), [])), l: sv(f, 'l') === 'en' ? 'en' : 'he' };
}
async function pxSave(deps, u) {
  const r = await fs(deps, 'PATCH', PX_COL() + '/' + u.uid + '?updateMask.fieldPaths=a&updateMask.fieldPaths=f&updateMask.fieldPaths=w&updateMask.fieldPaths=l&updateMask.fieldPaths=up',
    { fields: fields({ a: JSON.stringify(u.a), f: JSON.stringify(u.f), w: JSON.stringify(u.w), l: u.l, up: Date.now() }) });
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
}
async function pxGet(deps, uid) {
  if (PX.users.has(uid)) return PX.users.get(uid);
  const r = await fs(deps, 'GET', PX_COL() + '/' + uid);
  if (r.status !== 200 && r.status !== 404) throw new Error('fs_http_' + r.status);
  const u = pxUser(uid, r.status === 200 && r.j ? r.j.fields : {});
  if (PX.at) PX.users.set(uid, u);      // הרשימה בזיכרון — מעדכנים גם אותה
  return u;
}
/* מפתחות ה־VAPID — אותם של הסטודיו (studioVault/_vapid, מוצפנים; studio.js — vapidKeys). אין עדיין — נוצרים, רק אם אין */
const VAPID_AAD = 'webpush|vapid';
async function pxVapid(deps) {
  if (PX.vapid) return PX.vapid;
  const url = DOCS() + 'studioVault/_vapid';
  const r = await fs(deps, 'GET', url);
  let v = r.status === 200 ? vault.open(sv(r.j && r.j.fields, 'vk'), VAPID_AAD) : null;
  if (!(v && v.pub && v.d)) {
    const g = W.genVapid();
    const w = await fs(deps, 'PATCH', url + '?updateMask.fieldPaths=vk&updateMask.fieldPaths=pub&currentDocument.exists=false', { fields: fields({ vk: vault.seal(g, VAPID_AAD), pub: g.pub }) });
    if (w.status === 200) v = g;
    else { const r2 = await fs(deps, 'GET', url); v = r2.status === 200 ? vault.open(sv(r2.j && r2.j.fields, 'vk'), VAPID_AAD) : null; }
  }
  if (!(v && v.pub && v.d)) throw new Error('vapid');
  PX.vapid = v;
  return v;
}
function pxLimited(uid) {
  const now = Date.now(), arr = (PX.hits.get(uid) || []).filter((t) => now - t < 60e3);
  arr.push(now); PX.hits.set(uid, arr);
  if (PX.hits.size > 2000) PX.hits.clear();
  return arr.length > 30;
}
/* מהטלפון: { op:'pxa', act:'key' } → המפתח הציבורי · { act:'sync', alerts, sub?, lang } → נשמר; מחזיר מה כבר נשלח (fired)
   · { act:'off', e } → המכשיר הפסיק לקבל. לכל משתמש מחובר (לא רק למורשי הסנכרון של IBKR) */
async function pxApi(body, uid, res, deps) {
  const act = String(body.act || '');
  if (pxLimited(uid)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  if (act === 'key') return res.status(200).json({ ok: true, key: (await pxVapid(deps)).pub });
  if (act !== 'sync' && act !== 'off') return res.status(400).json({ ok: false, error: 'bad_params' });
  const sig = (x) => JSON.stringify([x.a, x.f, x.w.map((w) => w.e), x.l]);
  const u = await pxGet(deps, uid), fired = u.f, before = sig(u);
  if (act === 'off') u.w = W.dropSub(u.w, body.e);
  else {
    if (Array.isArray(body.alerts)) u.a = PXA.norm(body.alerts);
    u.f = PXA.pruneFired(fired, u.a);
    if (body.sub) { const sub = W.normSub(Object.assign({}, body.sub, { l: body.lang })); if (sub) u.w = W.addSub(u.w, sub, Date.now()); }
    if (body.lang === 'en' || body.lang === 'he') u.l = body.lang;
    for (const k of PX.last.keys()) if (k.startsWith(uid + '|') && !u.a.some((a) => k === uid + '|' + a.i)) PX.last.delete(k);
  }
  if (sig(u) !== before) await pxSave(deps, u);   // מכסת Firestore: בלי שינוי (פתיחת גרף רגילה) — בלי כתיבה
  return res.status(200).json(act === 'sync' ? { ok: true, n: u.w.length, fired } : { ok: true, n: u.w.length });
}
/* הבודק: כל 5 שנ׳ מהשרת שלנו (server.js — startPx). מחיר אחד לכל הסימבולים, Push לכל חצייה, ומסמן שנשלח */
async function pxCron(deps) {
  if (PX.busy) return { busy: true };
  PX.busy = true;
  try {
    const now = deps.now || Date.now();
    if (!PX.at || now - PX.at > PX_LIST_MS) {
      const r = await fs(deps, 'GET', PX_COL() + '?pageSize=300');
      if (r.status !== 200) return { err: 'fs_http_' + r.status };
      const m = new Map();
      for (const d of (r.j && r.j.documents) || []) {
        const uid = String(d.name || '').split('/').pop();
        if (UID_RE.test(uid)) m.set(uid, pxUser(uid, d.fields || {}));
      }
      PX.users = m; PX.at = now;
    }
    const users = [...PX.users.values()].filter((u) => u.w.length && u.a.some((a) => !u.f[a.i]));
    const syms = [...new Set(users.flatMap((u) => u.a.filter((a) => !u.f[a.i]).map((a) => a.s)))];
    if (!syms.length) return { users: PX.users.size, syms: 0 };
    const Q = deps.quotes || require('./quotes');
    const px = {}, deadline = Date.now() + 12000;
    for (let i = 0; i < syms.length; i += 40) {
      const ext = await Q._fetchExt(syms.slice(i, i + 40), deadline);
      for (const [s, x] of Object.entries(ext || {})) { const p = PXA.priceOf(x); if (p > 0) px[s] = p; }
    }
    const fires = PXA.check(users, px, PX.last);
    let sent = 0;
    if (fires.length) {
      const v = await pxVapid(deps);
      for (const { uid, hits } of fires) {
        const u = PX.users.get(uid);
        for (const h of hits.slice(0, 5)) {   // לכל היותר 5 התראות למשתמש בבדיקה (קפיצה חדה מעל כמה רמות)
          const r = await W.sendAll(deps, v, u.w, 'px', '', now, h);
          u.w = r.subs; sent += r.sent;
          u.f[h.a.i] = now;
        }
        for (const h of hits.slice(5)) u.f[h.a.i] = now;
        await pxSave(deps, u).catch(() => {});
      }
    }
    return { users: PX.users.size, syms: syms.length, fired: fires.reduce((n, x) => n + x.hits.length, 0), sent };
  } finally { PX.busy = false; }
}

/* ---------- IB Gateway (lib/ibgw.js) — שלב 1: Paper, ‏Read-Only ---------- */
const IBGW = require('../lib/ibgw');
/* SERVER_ONLY: פעולות שרק חדר האפליקציה עונה להן. ב־Vercel אין סוקט ל־Gateway — 421, והטלפון לא מנסה שוב (נשאר עם Flex) */
const SERVER_ONLY_OPS = new Set(['gwLive']);
/* Gateway אחד = חשבון IBKR אחד (של הבעלים). לכן רק הבעלים רואה אותו: IBGW_OWNER (uid), ואם לא הוגדר — המנהל.
   לא allowed() של הסנכרון: משתמש אחר ב־IBKR_SYNC_USERS היה רואה את החשבון של הבעלים */
function gwOwnerOk(user) {
  const o = String(process.env.IBGW_OWNER || '').trim();
  return o ? user.uid === o : isAdmin(user);
}
async function gwApi(body, user, res, deps) {
  if (process.env.VERCEL) return res.status(421).json({ ok: false, error: 'gw_remote' });
  if (!gwOwnerOk(user)) return res.status(403).json({ ok: false, error: 'not_owner' });
  IBGW.owner(user.uid);                              // ההתראה כשהסשן נפל — לבעלים
  if (!IBGW.cfg(deps.env).host) return res.status(200).json({ ok: true, gw: { st: 'off' } });
  IBGW.tick(deps);
  return res.status(200).json({ ok: true, gw: await IBGW.live(deps) });
}
/* מהבודק (כל 5 שנ׳): מתחזק את החיבור, וכשהסשן נפל — התראה לטלפון של הבעלים (המנויים של Invest, pxAlerts — מהזיכרון) */
async function gwTick(deps) {
  IBGW.tick(deps);
  const st = IBGW.alertDue((deps.now && deps.now()) || Date.now());
  const uid = st ? IBGW.owner() : '';
  if (!uid) return 0;
  const u = await pxGet(deps, uid);
  if (!u.w.length) return 0;
  const r = await W.sendAll(deps, await pxVapid(deps), u.w, 'ibgw', '', Date.now(), { st });
  if (r.subs.length !== u.w.length) { u.w = r.subs; await pxSave(deps, u).catch(() => {}); }
  return r.sent;
}

function allowed(user) {
  return !!(user && (isAdmin(user) || hasEmail(user, emails(process.env.IBKR_SYNC_USERS))));
}

async function handler(req, res, deps = {}) {
  if (req.method === 'GET' && String((req.query && req.query.job) || '') === 'px') {
    // רק בשרת שלנו: ב־Vercel הבודק לא רץ בכלל — אף אחד מבחוץ לא יכול לגרום לקריאות Firestore / הפעלות שם
    if (process.env.VERCEL) return res.status(404).json({ ok: false, error: 'not_here' });
    const secret = process.env.CRON_SECRET;
    if (secret && String(req.headers.authorization || '') !== 'Bearer ' + secret) return res.status(401).json({ ok: false });
    const gw = await gwTick(deps).catch(() => 0);
    try { return res.status(200).json(Object.assign({ ok: true, gw }, await pxCron(deps))); }
    catch (e) { return res.status(502).json({ ok: false, error: String(e && e.message || 'failed').slice(0, 30) }); }
  }
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
    if (body.op === 'pxa') return await pxApi(body, uid, res, deps);
    if (SERVER_ONLY_OPS.has(body.op)) return await gwApi(body, user, res, deps);
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
module.exports._px = PX;
module.exports.SERVER_ONLY_OPS = SERVER_ONLY_OPS;
