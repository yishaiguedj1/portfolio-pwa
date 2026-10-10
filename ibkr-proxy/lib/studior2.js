/* ת4 — הקבצים של הסטודיו ב־R2: איזה קובץ שייך לאיזו עבודה, ומי מורשה לגשת אליו.
   כל עבודה = תחילית אחת: st/<uid>/<job>/ — in/video, in/audio (מהטלפון), out/<שם> (תוצרים), ck/<שלב>.tgz (נקודות שמירה).
   הטלפון מעלה רק in/*; העובד קורא את in/* ומעלה רק out/* ו־ck/* — ורק של העבודה שהמפתח שלו פותח (נבדק ב־api/studio.js).
   הפונקציות כאן מקבלות את רשומת ההעלאה מהעבודה (job.r2[slot]) ומחזירות { res, rec } — מה לשמור מחליט הקורא.
   התעבורה עצמה לא עוברת דרך השרתון: רק קישורים חתומים לחלק אחד / לקובץ אחד. */
const R2 = require('./r2');

const GIB = 1024 * 1024 * 1024;
const UID_RE = /^[A-Za-z0-9]{6,128}$/;
const JOB_RE = /^j[A-Za-z0-9_-]{20}$/;
const OUT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
const CK_RE = /^(asr|al|tl|rv)$/;
const URLS_PER_CALL = 24;             // קישורים לחלקים בכל בקשה (כ־200MB+ בחלקים של 8MiB)
const PART_TTL = 3600;                // קישור לחלק — שעה
const GET_TTL = 6 * 3600;             // קישור הורדה לעובד — 6 שעות (הורדה עם המשך; פג → מבקשים חדש)
const VIEW_TTL = 3600;                // קישור צפייה / הורדה לטלפון

/* מה מותר בכל "תא": מי כותב, גודל מרבי, הנתיב */
function slotInfo(slot) {
  const s = String(slot || '');
  if (s === 'v') return { path: 'in/video', max: 20 * GIB, by: 'phone' };
  if (s === 'a') return { path: 'in/audio', max: 2 * GIB, by: 'phone' };
  let m = /^o:(.+)$/.exec(s);
  if (m && OUT_RE.test(m[1]) && !m[1].includes('..')) return { path: 'out/' + m[1], max: 30 * GIB, by: 'worker' };
  m = /^ck:(.+)$/.exec(s);
  if (m && CK_RE.test(m[1])) return { path: 'ck/' + m[1] + '.tgz', max: 4 * GIB, by: 'worker' };
  return null;
}
const prefixOf = (uid, job) => (UID_RE.test(uid) && JOB_RE.test(job) ? 'st/' + uid + '/' + job + '/' : '');
function keyOf(uid, job, slot) {
  const p = prefixOf(uid, job), i = slotInfo(slot);
  return p && i ? p + i.path : '';
}

/* רשומת העלאה שנשמרת בעבודה (job.r2[slot]): k, s (גודל), t (סוג), up, ps, ok (הושלם), at */
function normRec(x) {
  if (!x || typeof x !== 'object') return null;
  const r = { k: String(x.k || '').slice(0, 300), s: Math.max(0, Math.floor(Number(x.s) || 0)), t: String(x.t || '').slice(0, 80),
    up: String(x.up || '').slice(0, 400), ps: Math.max(0, Math.floor(Number(x.ps) || 0)), ok: x.ok ? 1 : 0, at: Math.max(0, Number(x.at) || 0) };
  return R2.okKey(r.k) && r.s > 0 ? r : null;
}

async function urlsFor(c, deps, rec, parts) {
  const out = {};
  for (const n of parts.slice(0, URLS_PER_CALL)) out[n] = await R2.mpPartUrl(c, deps, rec.k, rec.up, n, PART_TTL);
  return out;
}
function missingOf(rec, parts) {
  const have = new Set();
  for (const p of parts || []) {
    const n = R2.partsOf(rec.s, rec.ps);
    const want = p.n < n ? rec.ps : rec.s - rec.ps * (n - 1);
    if (p.n >= 1 && p.n <= n && p.size === want) have.add(p.n);
  }
  const miss = [];
  for (let n = 1; n <= R2.partsOf(rec.s, rec.ps); n++) if (!have.has(n)) miss.push(n);
  return { done: [...have].sort((a, b) => a - b), miss };
}

/* פתיחה / המשך של העלאה. אותו קובץ (אותו גודל) והעלאה פתוחה → ממשיכים; אחרת — העלאה חדשה (הישנה מבוטלת) */
async function upStart(c, deps, { uid, job, slot, size, type, rec, by }) {
  const info = slotInfo(slot);
  const k = keyOf(uid, job, slot);
  if (!info || !k) return { res: { ok: false, error: 'bad_slot' } };
  if (info.by !== by) return { res: { ok: false, error: 'forbidden' } };
  size = Math.floor(Number(size) || 0);
  if (size <= 0) return { res: { ok: false, error: 'bad_size' } };
  if (size > info.max) return { res: { ok: false, error: 'too_big' } };
  let r = normRec(rec);
  if (r && r.ok && r.s === size && r.k === k) return { res: { ok: true, file: { size: r.s }, done: [], urls: {} }, rec: r };
  if (r && r.up && r.s === size && r.k === k) {
    const parts = await R2.mpList(c, deps, r.k, r.up);
    if (parts) {
      const m = missingOf(r, parts);
      return { res: { ok: true, up: r.up, ps: r.ps, done: m.done, urls: await urlsFor(c, deps, r, m.miss) }, rec: r };
    }
  }
  if (r && r.up) await R2.mpAbort(c, deps, r.k, r.up).catch(() => null);
  const t = /^[\w.+-]+\/[\w.+-]+$/.test(type || '') ? type : 'application/octet-stream';
  r = { k, s: size, t, up: await R2.mpCreate(c, deps, k, t), ps: R2.partSize(size), ok: 0, at: (deps.now || Date.now)() };
  const m = missingOf(r, []);
  return { res: { ok: true, up: r.up, ps: r.ps, done: [], urls: await urlsFor(c, deps, r, m.miss) }, rec: r };
}

/* קישורים נוספים + מה כבר הגיע (גם אחרי תקלה / קישור שפג). up לא תואם → r2_gone (הטלפון מתחיל מחדש) */
async function upParts(c, deps, { rec, up }) {
  const r = normRec(rec);
  if (!r || !r.up || r.up !== String(up || '')) return { res: { ok: false, error: 'r2_gone' } };
  if (r.ok) return { res: { ok: true, file: { size: r.s }, done: [], urls: {} }, rec: r };
  const parts = await R2.mpList(c, deps, r.k, r.up);
  if (!parts) return { res: { ok: false, error: 'r2_gone' }, rec: Object.assign({}, r, { up: '' }) };
  const m = missingOf(r, parts);
  return { res: { ok: true, up: r.up, ps: r.ps, done: m.done, urls: await urlsFor(c, deps, r, m.miss) }, rec: r };
}

/* סגירה: רק כשכל החלקים הגיעו בגודל הנכון; אחר כך HEAD מוודא שהקובץ ב־R2 בגודל שהוצהר */
async function upDone(c, deps, { rec, up }) {
  const r = normRec(rec);
  if (!r || !r.up || r.up !== String(up || '')) {
    if (r && r.ok) return { res: { ok: true, file: { size: r.s } }, rec: r };
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
  return { res: { ok: true, file: { size: r.s } }, rec: done };
}

/* קישור הורדה לקובץ שהושלם. by=worker → 6 שעות; phone → שעה, עם שם קובץ להורדה */
async function getUrl(c, deps, { rec, by, name }) {
  const r = normRec(rec);
  if (!r || !r.ok) return { ok: false, error: 'not_ready' };
  const q = {};
  if (name) q['response-content-disposition'] = "attachment; filename*=UTF-8''" + encodeURIComponent(String(name).slice(0, 120));
  return { ok: true, url: await R2.presign(c, deps, { method: 'GET', key: r.k, query: q, expires: by === 'worker' ? GET_TTL : VIEW_TTL }), size: r.s };
}

/* מחיקת כל הקבצים של עבודה (מחיקת עבודה / ניקוי) + ביטול העלאות פתוחות */
async function purgeJob(c, deps, { uid, job, recs }) {
  const p = prefixOf(uid, job);
  if (!p) return 0;
  for (const r of Object.values(recs || {}).map(normRec).filter((x) => x && x.up)) await R2.mpAbort(c, deps, r.k, r.up).catch(() => null);
  const keys = await R2.list(c, deps, p);
  for (const it of keys) await R2.del(c, deps, it.key);
  return keys.length;
}

module.exports = { slotInfo, prefixOf, keyOf, normRec, missingOf, upStart, upParts, upDone, getUrl, purgeJob, URLS_PER_CALL };
