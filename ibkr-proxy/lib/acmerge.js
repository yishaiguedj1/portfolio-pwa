'use strict';
/* מיזוג שני חשבונות לאחד (26/10/2026, בקשת המשתמש: "להתחבר מכל מייל, ולקשר בינהם כך שיהיו על אותו משתמש").
   מתי: המשתמש מחובר בחשבון A ומוסיף שיטת כניסה (Google / מייל) שכבר שייכת לחשבון אחר B, עם נתונים משלו. הטלפון מוכיח
   שהוא מחזיק את B (טוקן טרי של B — התחברות של עד 5 דקות, lib/session.js op:'merge'), השרתון מעביר את הנתונים של B ל־A
   — ואז הטלפון מוחק את B ב־Firebase ומקשר את שיטת הכניסה ל־A.

   מה עובר (חשבון השירות עוקף את כללי Firestore):
   - Invest: users/{B}.db → users/{A}.db, מיזוג כמו "שחזור מגיבוי" (pfBackupMerge ב־app.js): מה שכבר ב־A לא נדרס —
     מניה לפי סימבול, עסקה לפי מזהה/תוכן, הפקדות ופנסיה לפי ספירה, קרנות לפי שם, רשימות מעקב לפי סימבול/מזהה/שם.
   - Academy: academyUsers/{B}.lib → academyUsers/{A}.lib, לפי ספר — A גובר (libmove.merged).
   - Studio: העבודות של B (studioJobs.uid) עוברות ל־A, והקבצים שלהן ב־R2 (st/<uid>/…) מועתקים למפתח של A.
     עבודה שרצה = לא ממזגים בכלל (busy) — עוד רגע תסתיים. studioStats של B — רק כש־A עוד אין.
   - הכספות של B (IBKR, Drive, Routine) מוצפנות עם ה־uid של B (AAD) — לא עוברות; נמחקות. מתחברים שוב מ־A.
   - בסוף: המסמכים של B נמחקים. אף פעם לא נוגעים ב־A מעבר להוספה. */
const R2 = require('./r2');
const LM = require('./libmove');
const S = require('./studio');

const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';
const BASE = () => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents';
const UID_RE = /^[A-Za-z0-9_-]{6,128}$/;
const VAULTS = ['ibkrVault', 'driveVault', 'studioDrive', 'studioVault', 'studioBrowse', 'studioOps'];
const JOBS_MAX = 500;

/* ---------------------------------------------------------------- ערכי Firestore ↔ JS (המסמך של Invest נכתב ב־SDK כמו שהוא) */
function fsToJs(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return +v.integerValue;
  if ('doubleValue' in v) return +v.doubleValue;
  if ('booleanValue' in v) return !!v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(fsToJs);
  if ('mapValue' in v) { const o = {}; for (const [k, x] of Object.entries((v.mapValue && v.mapValue.fields) || {})) o[k] = fsToJs(x); return o; }
  return null;
}
function jsToFs(x) {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === 'string') return { stringValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(jsToFs) } };
  if (typeof x === 'object') { const f = {}; for (const [k, v] of Object.entries(x)) if (v !== undefined) f[k] = jsToFs(v); return { mapValue: { fields: f } }; }
  return { nullValue: null };
}

/* ---------------------------------------------------------------- Invest (טהורה) — במקום, על a. מחזיר כמה נוסף */
const clone = (x) => JSON.parse(JSON.stringify(x));
const symKey = (s) => String(s || '').trim().toUpperCase();
const arr = (x) => (Array.isArray(x) ? x : []);
function tradeKey(t) { return [symKey(t && t.sym), t && t.date, t && t.side, +(t && t.qty) || 0, +(t && t.price) || 0].join('|'); }
function depKey(d) { const o = Object.assign({}, d); delete o.id; return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]])); }
function addMulti(local, incoming, key) {
  const have = new Map();
  for (const x of local) { const k = key(x); have.set(k, (have.get(k) || 0) + 1); }
  let n = 0;
  for (const x of incoming) {
    const k = key(x), c = have.get(k) || 0;
    if (c > 0) { have.set(k, c - 1); continue; }
    local.push(clone(x)); n++;
  }
  return n;
}
function wlUnion(items, add) {
  const seen = new Set(items.map((w) => symKey(w && w.sym)));
  let n = 0;
  for (const w of arr(add)) {
    const k = symKey(w && w.sym);
    if (!k || seen.has(k)) continue;
    seen.add(k); items.push(clone(w)); n++;
  }
  return n;
}
function investMerge(a, b) {
  const out = { n: 0 };
  if (!b || typeof b !== 'object') return out;
  for (const k of ['positions', 'deposits', 'manualTrades', 'pensionFunds', 'pensionDeposits', 'wishlist', 'wlExtra']) if (!Array.isArray(a[k])) a[k] = [];
  const ids = new Set(a.manualTrades.map((x) => String((x && x.id) || '')).filter(Boolean));
  const keys = new Set(a.manualTrades.map(tradeKey));
  for (const t of arr(b.manualTrades)) {
    if (!t || !symKey(t.sym) || (t.id && ids.has(String(t.id))) || keys.has(tradeKey(t))) continue;
    a.manualTrades.push(clone(t)); if (t.id) ids.add(String(t.id)); keys.add(tradeKey(t)); out.n++;
  }
  const held = new Set(a.positions.map((p) => symKey(p && p.sym)));
  for (const p of arr(b.positions)) {
    const k = symKey(p && p.sym);
    if (!k || held.has(k) || (p && p.fromTrades)) continue;
    a.positions.push(clone(p)); held.add(k); out.n++;
  }
  out.n += addMulti(a.deposits, arr(b.deposits), depKey);
  const funds = new Set(a.pensionFunds.map((f) => String((f && f.name) || '').trim().toLowerCase()));
  for (const f of arr(b.pensionFunds)) {
    const k = String((f && f.name) || '').trim().toLowerCase();
    if (!k || funds.has(k)) continue;
    a.pensionFunds.push(clone(f)); funds.add(k); out.n++;
  }
  out.n += addMulti(a.pensionDeposits, arr(b.pensionDeposits), depKey);
  const ac = a.cash || {}, bc = b.cash || {};
  if (!(+ac.usd || +ac.ils) && (+bc.usd || +bc.ils)) { a.cash = { usd: +bc.usd || 0, ils: +bc.ils || 0 }; out.n++; }
  out.n += wlUnion(a.wishlist, b.wishlist);
  if (!a.wlMainName && b.wlMainName) a.wlMainName = String(b.wlMainName);
  for (const l of arr(b.wlExtra)) {
    if (!l || !l.id) continue;
    const nm = String(l.name || '').trim().toLowerCase();
    const mine = a.wlExtra.find((x) => x && x.id === l.id) || a.wlExtra.find((x) => x && nm && String(x.name || '').trim().toLowerCase() === nm);
    if (mine) { if (!Array.isArray(mine.items)) mine.items = []; out.n += wlUnion(mine.items, l.items); continue; }
    const items = []; out.n += wlUnion(items, l.items);
    a.wlExtra.push({ id: String(l.id), name: String(l.name || ''), items });
  }
  // שדות אחרים (סידור, דמו וכו') — רק כש־A עוד אין
  for (const [k, v] of Object.entries(b)) if (a[k] === undefined && k !== 'demo') a[k] = clone(v);
  return out;
}

/* ---------------------------------------------------------------- Firestore */
async function fs(deps, method, path, body) {
  const tk = await deps.token();
  const r = await deps.fetch(BASE() + path, { method, headers: Object.assign({ Authorization: 'Bearer ' + tk }, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined });
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
  return r.json();
}
async function jobsOf(deps, uid) {
  const j = await fs(deps, 'POST', ':runQuery', { structuredQuery: { from: [{ collectionId: 'studioJobs' }], limit: JOBS_MAX,
    where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: uid } } } } });
  return (Array.isArray(j) ? j : []).filter((x) => x && x.document && x.document.name)
    .map((x) => Object.assign(S.fromFields(x.document.fields), { id: String(x.document.name).split('/').pop() }));
}
async function upRecs(deps, folder) {
  const j = await fs(deps, 'POST', ':runQuery', { structuredQuery: { from: [{ collectionId: 'studioUp' }], limit: 500,
    where: { fieldFilter: { field: { fieldPath: 'f' }, op: 'EQUAL', value: { stringValue: folder } } } } });
  return (Array.isArray(j) ? j : []).filter((x) => x && x.document && x.document.name)
    .map((x) => ({ id: String(x.document.name).split('/').pop(), f: x.document.fields || {} }));
}
const patch = (deps, col, id, fields) => fs(deps, 'PATCH', '/' + col + '/' + id + '?' + Object.keys(fields).map((k) => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&'), { fields });
const del = (deps, col, id) => fs(deps, 'DELETE', '/' + col + '/' + id).catch(() => null);

/* האם אפשר למזג עכשיו: עבודה של B בתור / רצה = לא (העובד כותב אליה עם ה־uid הישן). טיוטה ('new') עוברת */
const busyJob = (j) => (j.state === 'queued' || j.state === 'running') && j.kind !== 'ping';

/* ---------------------------------------------------------------- Studio: העברה / מחיקה של העבודות של חשבון */
async function moveJobs(deps, jobs, from, to, out) {
  const c = (deps.r2config || R2.config)();
  const rd = { fetch: deps.fetch, now: deps.nowMs || Date.now };
  for (const j of jobs) {
    if (/^R2_/.test(String(j.folder || ''))) {
      if (!c.ok) { out.kept++; continue; }
      try {
        const items = await R2.list(c, rd, 'st/' + from + '/' + j.folder + '_');
        for (const it of items) {
          await R2.copy(c, rd, it.key, 'st/' + to + '/' + it.key.slice(('st/' + from + '/').length));
          out.files++;
        }
        for (const r of await upRecs(deps, j.folder)) {
          const k = r.f.k && r.f.k.stringValue ? r.f.k.stringValue.replace('st/' + from + '/', 'st/' + to + '/') : '';
          await patch(deps, 'studioUp', r.id, Object.assign({ uid: { stringValue: to } }, k ? { k: { stringValue: k } } : {}));
        }
        for (const it of items) await R2.del(c, rd, it.key).catch(() => null);
      } catch (e) { out.kept++; continue; }
    }
    await patch(deps, 'studioJobs', j.id, { uid: { stringValue: to } });
    out.jobs++;
  }
}
/* "להשאיר רק את הנתונים של אחד" — העבודות של השני נמחקות, עם הקבצים שלהן ב־R2 (תיקייה ב־Drive של המשתמש לא נוגעים) */
async function dropJobs(deps, jobs, uid, out) {
  const c = (deps.r2config || R2.config)();
  const rd = { fetch: deps.fetch, now: deps.nowMs || Date.now };
  for (const j of jobs) {
    if (/^R2_/.test(String(j.folder || '')) && c.ok) {
      try {
        for (const it of await R2.list(c, rd, 'st/' + uid + '/' + j.folder + '_')) await R2.del(c, rd, it.key).catch(() => null);
        for (const r of await upRecs(deps, j.folder)) await del(deps, 'studioUp', r.id);
      } catch (e) {}
    }
    await del(deps, 'studioJobs', j.id);
    out.dropped++;
  }
}

/* ---------------------------------------------------------------- המיזוג
   keep: 'both' (ברירת מחדל) = הנתונים של B מצטרפים ל־A בלי כפילויות; 'a' = רק מה שכבר ב־A (של B נמחק);
   'b' = רק הנתונים של B (מחליפים את של A). בכל מקרה החשבון שנשאר הוא A, ו־B נמחק */
const KEEP = ['both', 'a', 'b'];
async function mergeAccounts(deps, from, to, keep) {
  if (!UID_RE.test(String(from || '')) || !UID_RE.test(String(to || '')) || from === to) throw new Error('bad_uid');
  const k = KEEP.includes(keep) ? keep : 'both';
  const out = { keep: k, inv: 0, ac: false, jobs: 0, files: 0, kept: 0, dropped: 0, stats: false };
  const jobsB = await jobsOf(deps, from);
  const jobsA = k === 'b' ? await jobsOf(deps, to) : [];
  if (jobsB.some(busyJob) || jobsA.some(busyJob)) return Object.assign(out, { busy: true });

  // Invest
  const bd = await fs(deps, 'GET', '/users/' + from);
  const bdb = bd && bd.fields && bd.fields.db ? fsToJs(bd.fields.db) : null;
  if (k === 'both' && bdb && !bdb.demo) {
    const ad = await fs(deps, 'GET', '/users/' + to);
    const adb = ad && ad.fields && ad.fields.db ? fsToJs(ad.fields.db) : { positions: [], deposits: [] };
    out.inv = investMerge(adb, bdb).n;
    await patch(deps, 'users', to, { v: { integerValue: '1' }, db: jsToFs(adb) });
  } else if (k === 'b') {
    if (bdb && !bdb.demo) { await patch(deps, 'users', to, { v: { integerValue: '1' }, db: bd.fields.db }); out.inv = -1; }
    else await del(deps, 'users', to);
  }
  // Academy
  const bl = await fs(deps, 'GET', '/academyUsers/' + from);
  const blib = bl && bl.fields && bl.fields.lib;
  if (k === 'both' && blib) {
    const al = await fs(deps, 'GET', '/academyUsers/' + to);
    await patch(deps, 'academyUsers', to, { lib: LM.merged(blib, al && al.fields && al.fields.lib) });
    out.ac = true;
  } else if (k === 'b') {
    if (blib) { await patch(deps, 'academyUsers', to, { lib: blib }); out.ac = true; }
    else await del(deps, 'academyUsers', to);
  }
  // Studio
  if (k === 'a') await dropJobs(deps, jobsB, from, out);
  else {
    if (k === 'b') await dropJobs(deps, jobsA, to, out);
    await moveJobs(deps, jobsB, from, to, out);
  }
  const bs = await fs(deps, 'GET', '/studioStats/' + from);
  if (k !== 'a' && bs && bs.fields) {
    const as = k === 'b' ? null : await fs(deps, 'GET', '/studioStats/' + to);
    if (!as) { if (k === 'b') await del(deps, 'studioStats', to); await patch(deps, 'studioStats', to, bs.fields); out.stats = true; }
  }
  // B — המסמכים נמחקים (העבודות שלא עברו נשארות עם B, וייקו בניקוי הרגיל)
  for (const col of ['users', 'academyUsers', 'studioStats'].concat(VAULTS)) await del(deps, col, from);
  return out;
}

module.exports = { mergeAccounts, investMerge, fsToJs, jsToFs, busyJob, KEEP };
