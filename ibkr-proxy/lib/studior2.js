/* ת4 — הקבצים של הסטודיו ב־R2, באותה צורה של Drive כדי שהקוד שמעל לא ישתנה:
   "תיקייה" של עבודה = R2_<מזהה העבודה>, ו"מזהה קובץ" = <התיקייה>_<12 תווים אקראיים> — עובר את FILE_ID_RE כמו מזהה של Drive.
   עבודות משנה (הפקה מחדש, בקשת AI, סט הזהב) יורשות את התיקייה של ההורה, כמו ב־Drive.
   המפתח ב־R2: st/<uid>/<מזהה הקובץ> — הבעלים בנתיב, כך שקובץ של משתמש אחד לא נגיש דרך עבודה של אחר.
   רשומת העלאה (מהלך ה־Multipart, השם והגודל) נשמרת בנפרד לכל קובץ (studioUp/<id>) — בלי לגעת במסמך העבודה,
   שהעובד והטלפון כותבים אליו בו זמנית. הפונקציות כאן מחזירות { res, rec } — מה לשמור מחליט הקורא (api/studio.js).
   התעבורה עצמה לא עוברת דרך השרתון: רק קישורים חתומים לחלק אחד / לקובץ אחד. */
const crypto = require('crypto');
const R2 = require('./r2');

const GIB = 1024 * 1024 * 1024;
const UID_RE = /^[A-Za-z0-9]{6,128}$/;
const FOLDER_RE = /^R2_j[A-Za-z0-9_-]{20}$/;
const ID_RE = /^R2_j[A-Za-z0-9_-]{20}_[A-Za-z0-9]{12}$/;
const MAX = { phone: 20 * GIB, worker: 30 * GIB };
const URLS_PER_CALL = 24;             // קישורים לחלקים בכל בקשה (כ־200MB+ בחלקים של 8MiB)
const PART_TTL = 3600;                // קישור לחלק — שעה
const GET_TTL = 6 * 3600;             // קישור הורדה לעובד — 6 שעות (הורדה עם המשך; פג → מבקשים חדש)
const VIEW_TTL = 3600;                // קישור צפייה / הורדה לטלפון

const isFolder = (f) => FOLDER_RE.test(String(f || ''));
const isId = (id) => ID_RE.test(String(id || ''));
const folderFor = (jobId) => 'R2_' + jobId;
const folderOfId = (id) => (isId(id) ? String(id).slice(0, String(id).lastIndexOf('_')) : '');
const inFolder = (id, folder) => isId(id) && isFolder(folder) && String(id).startsWith(folder + '_');
function newId(folder) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (const b of crypto.randomBytes(12)) s += a[b % a.length];
  return folder + '_' + s;
}
const keyOf = (uid, id) => (UID_RE.test(String(uid || '')) && isId(id) ? 'st/' + uid + '/' + id : '');

/* רשומת העלאה: k (מפתח), s (גודל), t (סוג), n (שם לתצוגה), up (מזהה ה־Multipart), ps (גודל חלק), ok (הושלם), at, by, uid */
function normRec(x) {
  if (!x || typeof x !== 'object') return null;
  const r = { k: String(x.k || '').slice(0, 300), s: Math.max(0, Math.floor(Number(x.s) || 0)), t: String(x.t || '').slice(0, 80),
    n: String(x.n || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 200), up: String(x.up || '').slice(0, 400),
    ps: Math.max(0, Math.floor(Number(x.ps) || 0)), ok: x.ok ? 1 : 0, at: Math.max(0, Number(x.at) || 0),
    by: x.by === 'worker' ? 'worker' : 'phone', uid: String(x.uid || '') };
  return R2.okKey(r.k) && r.s > 0 && UID_RE.test(r.uid) ? r : null;
}

async function urlsFor(c, deps, rec, parts) {
  const out = {};
  for (const n of parts.slice(0, URLS_PER_CALL)) out[n] = await R2.mpPartUrl(c, deps, rec.k, rec.up, n, PART_TTL);
  return out;
}
function missingOf(rec, parts) {
  const n = R2.partsOf(rec.s, rec.ps);
  const have = new Set();
  for (const p of parts || []) {
    const want = p.n < n ? rec.ps : rec.s - rec.ps * (n - 1);
    if (p.n >= 1 && p.n <= n && p.size === want) have.add(p.n);
  }
  const miss = [];
  for (let i = 1; i <= n; i++) if (!have.has(i)) miss.push(i);
  return { done: [...have].sort((a, b) => a - b), miss };
}
const okType = (t) => (/^[\w.+-]+\/[\w.+-]+$/.test(t || '') ? t : 'application/octet-stream');

/* פתיחה / המשך של העלאה.
   id ריק = קובץ חדש בתיקייה; id קיים = המשך (אותו גודל) או תוכן חדש לאותו קובץ (replace — איכויות הצפייה מחליפות את המקור).
   rec = הרשומה השמורה של ה־id הזה (אם יש). */
async function upStart(c, deps, { uid, folder, id, size, type, name, rec, by, replace }) {
  if (!isFolder(folder) || !UID_RE.test(String(uid || ''))) return { res: { ok: false, error: 'bad_folder' } };
  if (id && !inFolder(id, folder)) return { res: { ok: false, error: 'bad_id' } };
  size = Math.floor(Number(size) || 0);
  if (!(size > 0)) return { res: { ok: false, error: 'bad_size' } };
  if (size > MAX[by === 'worker' ? 'worker' : 'phone']) return { res: { ok: false, error: 'too_big' } };
  let r = normRec(rec);
  if (r && r.uid !== uid) return { res: { ok: false, error: 'forbidden' } };
  if (r && r.ok && r.s === size && !replace) return { res: { ok: true, id, file: { size: r.s }, done: [], urls: {} }, rec: r };
  if (r && r.up && r.s === size) {
    const parts = await R2.mpList(c, deps, r.k, r.up);
    if (parts) {
      const m = missingOf(r, parts);
      return { res: { ok: true, id, up: r.up, ps: r.ps, done: m.done, urls: await urlsFor(c, deps, r, m.miss) }, rec: r };
    }
  }
  if (r && r.up) await R2.mpAbort(c, deps, r.k, r.up).catch(() => null);
  id = id || newId(folder);
  const k = keyOf(uid, id);
  const t = okType(type);
  r = { k, s: size, t, n: String(name || (r && r.n) || '').slice(0, 200), up: await R2.mpCreate(c, deps, k, t), ps: R2.partSize(size),
    ok: 0, at: (deps.now || Date.now)(), by: by === 'worker' ? 'worker' : 'phone', uid };
  const m = missingOf(r, []);
  return { res: { ok: true, id, up: r.up, ps: r.ps, done: [], urls: await urlsFor(c, deps, r, m.miss) }, rec: normRec(r) };
}

/* קישורים נוספים + מה כבר הגיע (גם אחרי תקלה / קישור שפג). up לא תואם → r2_gone (מתחילים מחדש) */
async function upParts(c, deps, { id, rec, up, uid }) {
  const r = normRec(rec);
  if (!r || r.uid !== uid) return { res: { ok: false, error: 'r2_gone' } };
  if (r.ok && (!up || up === r.up || !r.up)) return { res: { ok: true, id, file: { size: r.s }, done: [], urls: {} }, rec: r };
  if (!r.up || r.up !== String(up || '')) return { res: { ok: false, error: 'r2_gone' } };
  const parts = await R2.mpList(c, deps, r.k, r.up);
  if (!parts) return { res: { ok: false, error: 'r2_gone' }, rec: Object.assign({}, r, { up: '' }) };
  const m = missingOf(r, parts);
  return { res: { ok: true, id, up: r.up, ps: r.ps, done: m.done, urls: await urlsFor(c, deps, r, m.miss) }, rec: r };
}

/* סגירה: רק כשכל החלקים הגיעו בגודל הנכון; אחר כך HEAD מוודא שהקובץ ב־R2 בגודל שהוצהר */
async function upDone(c, deps, { id, rec, up, uid }) {
  const r = normRec(rec);
  if (!r || r.uid !== uid) return { res: { ok: false, error: 'r2_gone' } };
  if (!r.up || r.up !== String(up || '')) {
    if (r.ok) return { res: { ok: true, id, file: { size: r.s, name: r.n, mimeType: r.t } }, rec: r };
    return { res: { ok: false, error: 'r2_gone' } };
  }
  const parts = await R2.mpList(c, deps, r.k, r.up);
  if (!parts) return { res: { ok: false, error: 'r2_gone' }, rec: Object.assign({}, r, { up: '' }) };
  const chk = R2.partsCheck(parts, r.s, r.ps);
  if (!chk.ok) return { res: { ok: false, error: 'r2_parts', missing: chk.missing.slice(0, 200) } };
  await R2.mpComplete(c, deps, r.k, r.up, parts.filter((p) => p.n <= chk.n));
  const h = await R2.head(c, deps, r.k);
  if (!h || h.size !== r.s) return { res: { ok: false, error: 'r2_size' } };
  const done = Object.assign({}, r, { up: '', ok: 1, at: (deps.now || Date.now)() });
  return { res: { ok: true, id, file: { size: r.s, name: r.n, mimeType: r.t } }, rec: done };
}

/* הקובץ קיים ב־R2 ושייך לתיקייה — כמו driveFileInFolder: { id, name, size } או null */
async function fileIn(c, deps, { uid, folder, id, rec }) {
  if (!inFolder(id, folder)) return null;
  const k = keyOf(uid, id);
  if (!k) return null;
  const h = await R2.head(c, deps, k);
  if (!h) return null;
  const r = normRec(rec);
  return { id, name: r && r.uid === uid ? r.n : '', size: h.size, mime: (r && r.t) || h.type || '' };
}

/* קישור הורדה לקובץ קיים. worker → 6 שעות; phone → שעה, ושם להורדה אם ביקשו */
async function getUrl(c, deps, { uid, folder, id, by, name }) {
  if (!inFolder(id, folder)) return { ok: false, error: 'bad_id' };
  const k = keyOf(uid, id);
  const h = k ? await R2.head(c, deps, k) : null;
  if (!h) return { ok: false, error: 'not_found' };
  const q = {};
  if (name) q['response-content-disposition'] = "attachment; filename*=UTF-8''" + encodeURIComponent(String(name).slice(0, 120));
  return { ok: true, url: await R2.presign(c, deps, { method: 'GET', key: k, query: q, expires: by === 'worker' ? GET_TTL : VIEW_TTL }),
    size: h.size, type: h.type || '', exp: (deps.now || Date.now)() + (by === 'worker' ? GET_TTL : VIEW_TTL) * 1000 };
}

async function delFile(c, deps, { uid, folder, id, rec }) {
  if (!inFolder(id, folder)) return false;
  const r = normRec(rec);
  if (r && r.up) await R2.mpAbort(c, deps, r.k, r.up).catch(() => null);
  await R2.del(c, deps, keyOf(uid, id));
  return true;
}

/* מחיקת כל הקבצים של תיקייה (מחיקת העבודה שהתיקייה שלה) + ביטול העלאות פתוחות */
async function purgeFolder(c, deps, { uid, folder, recs }) {
  if (!isFolder(folder) || !UID_RE.test(String(uid || ''))) return 0;
  for (const r of (recs || []).map(normRec).filter((x) => x && x.up && x.uid === uid)) await R2.mpAbort(c, deps, r.k, r.up).catch(() => null);
  const keys = await R2.list(c, deps, 'st/' + uid + '/' + folder + '_');
  for (const it of keys) await R2.del(c, deps, it.key);
  return keys.length;
}

module.exports = { isFolder, isId, folderOfId, inFolder, folderFor, newId, keyOf, normRec, missingOf, upStart, upParts, upDone, fileIn, getUrl, delFile,
  purgeFolder, URLS_PER_CALL, MAX };
