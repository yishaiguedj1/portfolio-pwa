/* סטודיו התרגום — שלב 2 (v355): עבודות, מפתח עבודה, החיבור ל־Routine והדיווח מהעובד בענן.
   הטלפון לא מחזיק שום סוד: הכתובת והמפתח של ה־Routine נשמרים רק מוצפנים בכספת (lib/vault.js, AAD = studio|uid|r)
   במסמך studioVault/{uid}, ולא חוזרים לטלפון לעולם. כל הפעלה של ה־Routine מקבלת מפתח עבודה חדש (32 בתים אקראיים):
   נשמר רק ה־SHA-256 שלו, תקף 48 שעות, להפעלה אחת (הפעלה חדשה מחליפה אותו), ואחרי שהעבודה נגמרה הוא רק מחזיר "עצור".
   הקובץ טהור (בלי רשת) — api/studio.js עושה את הקריאות, ו־tests/run.js בודק את שניהם. */
const crypto = require('crypto');

const ROUTINE_URL_RE = /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/(trig_[A-Za-z0-9]{8,64})\/fire$/;
const ROUTINE_KEY_RE = /^sk-ant-oat01-[A-Za-z0-9_-]{20,400}$/;
const JOB_RE = /^j[A-Za-z0-9_-]{20}$/;
const KEY_RE = /^[A-Za-z0-9_-]{43}$/;
const FILE_ID_RE = /^[A-Za-z0-9_-]{10,100}$/;
const SESSION_RE = /^session_[A-Za-z0-9]{8,80}$/;
const SESSION_URL_RE = /^https:\/\/claude\.ai\/code\/session_[A-Za-z0-9]{8,80}$/;
const ERR_RE = /^[a-z0-9_]{1,40}$/;
const KEY_TTL = 48 * 3600e3;
const CLAIM_WAIT = { ping: 6 * 60e3, tr: 30 * 60e3 };   // הופעל ולא נלקח בזמן הזה = Claude לא התחיל (סשן שנפל / הנחיה אחרת)
/* השלבים, בסדר — אותם מזהים באפליקציה (studionet.js) ובעובד (translator/job.py) */
const STAGES = ['up', 'tr', 'al', 'tl', 'rv', 'bn', 'sv'];
const FINAL = ['done', 'failed', 'cancelled'];
const ACTIVE = ['new', 'queued', 'running'];
const KINDS = ['ping', 'tr'];
/* מה העובד בענן יודע לבצע. שלב 2: רק "בדיקת חיבור"; התרגום עצמו מגיע בשלב 3 — אז 'tr' נכנס לכאן, והאפליקציה לא משתנה */
const WORKER_KINDS = ['ping'];
const MODES = ['opus-medium', 'opus-high', 'opus-max', 'sonnet-medium', 'sonnet-high'];
const LANGS = ['en', 'he', 'ar', 'ru', 'es', 'fr', 'de', 'it', 'pt', 'uk', 'pl', 'nl', 'tr', 'fa', 'hi', 'zh', 'ja', 'ko', 'am'];
const STYLES = ['bold', 'classic', 'karaoke'];
const OUTS = ['same', 'compact', 'mkv'];
const MAX_SIZE = 64 * 1024 ** 3;            // 64GB — הרבה מעל כל ראיון (Drive מקבל עד 5TB)
const MAX_ACTIVE = 5;                       // עבודות פתוחות בבת אחת למשתמש
const MAX_STORED = 100;                     // מעבר לזה — הישנות שהסתיימו נמחקות
const FIRE_HOUR = 20;                       // הפעלות בשעה למשתמש (ל־Routine מותר 30 — שומרים מרווח לתיקונים ול"הפעל עכשיו")
const TEST_GAP = 60e3;                      // בדיקת חיבור — לכל היותר פעם בדקה

/* ---------- קלט ---------- */
/* הכתובת והמפתח כמו שהם מודבקים (רווחים, "Bearer " בטעות) — ואז בדיקת צורה קפדנית */
function normRoutine(url, key) {
  const u = String(url || '').trim();
  const k = String(key || '').trim().replace(/^Bearer\s+/i, '');
  const m = ROUTINE_URL_RE.exec(u);
  if (!m) return { error: 'bad_url' };
  if (!ROUTINE_KEY_RE.test(k)) return { error: 'bad_key' };
  return { u, k, trig: m[1] };
}
const hintOf = (trig) => 'trig_…' + String(trig || '').slice(-4);
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const uniq = (a, ok) => (Array.isArray(a) ? a : []).filter((x, i, arr) => ok(x) && arr.indexOf(x) === i);

/* פרטי העבודה מהטלפון — רק מה שהעובד צריך; הכל נבדק ומוגבל */
function normSpec(s) {
  if (!s || typeof s !== 'object') return null;
  const name = clean(s.name, 200), size = Math.floor(Number(s.size) || 0);
  if (!name || !(size > 0) || size > MAX_SIZE) return null;
  const to = uniq(s.to, (c) => LANGS.includes(c)).slice(0, 12);
  if (!to.length) return null;
  return {
    name, size,
    type: String(s.type || '').slice(0, 60).replace(/[^\w.+/-]/g, ''),
    dur: Math.max(0, Math.min(24 * 3600, Math.round(Number(s.dur) || 0))),     // שניות (0 = לא ידוע)
    from: s.from === 'auto' || LANGS.includes(s.from) ? s.from : 'auto',
    to,
    mode: MODES.includes(s.mode) ? s.mode : MODES[0],
    out: uniq(s.out, (k) => OUTS.includes(k)),                                  // SRT תמיד; ריק = SRT בלבד
    style: STYLES.includes(s.style) ? s.style : STYLES[0],
    terms: String(s.terms || '').replace(/\u0000/g, '').slice(0, 1000),
  };
}
/* קובץ שעלה ל־Drive (מה ש־Drive עצמו החזיר — api/studio.js מאמת מולו) */
function normFile(f) {
  if (!f || !FILE_ID_RE.test(String(f.id || ''))) return null;
  const size = Math.floor(Number(f.size) || 0);
  if (!(size > 0)) return null;
  return { id: f.id, name: clean(f.name, 200), size, mime: String(f.mimeType || f.mime || '').slice(0, 80) };
}

/* ---------- מזהים ומפתחות ---------- */
const newJobId = () => 'j' + crypto.randomBytes(15).toString('base64url');
const newKey = () => crypto.randomBytes(32).toString('base64url');
const keyHash = (k) => crypto.createHash('sha256').update(String(k)).digest('hex');
function keyMatches(job, key) {
  if (!job || !job.kh || !KEY_RE.test(String(key || ''))) return false;
  const a = Buffer.from(keyHash(key), 'hex'), b = Buffer.from(String(job.kh), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
/* מה נשלח ל־Routine: רק מזהה העבודה ומפתח העבודה. הסשן מקבל את זה עטוף כ"נתונים לא מהימנים";
   ההנחיה השמורה (מאשף החיבור) אומרת לו לקרוא רק את שתי השורות ולפעול לפי translator/RUNBOOK.md */
const fireText = (jobId, key) => 'SNOWBALL-STUDIO\njob=' + jobId + '\nkey=' + key + '\n';
function fireError(status, j) {
  const msg = String((j && j.error && j.error.message) || '');
  if (status === 401) return 'routine_auth';
  if (status === 403) return 'routine_forbidden';
  if (status === 404) return 'routine_missing';
  if (status === 429) return 'routine_rate';
  if (status === 400) return /paus/i.test(msg) ? 'routine_paused' : 'routine_bad';
  if (status >= 500) return 'routine_down';
  return 'routine_http_' + status;
}
function fireSession(j) {
  const id = String((j && j.claude_code_session_id) || ''), url = String((j && j.claude_code_session_url) || '');
  if (!SESSION_RE.test(id)) return null;
  return { id, url: SESSION_URL_RE.test(url) ? url : '' };
}
/* תקציב ההפעלות: חותמות הזמן של השעה האחרונה */
const recentFires = (fh, now) => (Array.isArray(fh) ? fh : []).filter((t) => now - t < 3600e3).slice(-50);

/* ---------- מצב העבודה ---------- */
/* הופעל ולא נלקח בזמן סביר → נכשל (נבדק בכל קריאה; נשמר בכתיבה הבאה) */
function effState(job, now) {
  if (job && job.state === 'queued' && job.fired && now - job.fired > (CLAIM_WAIT[job.kind] || CLAIM_WAIT.tr)) return { state: 'failed', err: 'no_claim' };
  return { state: job ? job.state : 'failed', err: job ? job.err || '' : '' };
}
const fileView = (f) => (f && f.id ? { id: f.id, name: f.name || '', size: f.size || 0, at: f.at || 0 } : null);
/* מה הטלפון רואה — בלי המפתח (גם לא ה־hash) */
function publicJob(job, now) {
  const e = effState(job, now);
  return {
    id: job.id, kind: job.kind, state: e.state, err: e.err, created: job.created || 0, updated: job.updated || 0,
    fired: job.fired || 0, claimed: job.claimed || 0, ended: job.ended || 0,
    spec: job.spec || null, files: { a: fileView(job.fa), v: fileView(job.fv) },
    sess: job.sess && job.sess.url ? { url: job.sess.url } : null,
    prog: job.prog || null,
  };
}
/* מה העובד מקבל: מה להוריד ולאן להעלות — שום דבר מעבר לעבודה הזו */
function workerJob(job) {
  return { id: job.id, kind: job.kind, state: job.state, spec: job.spec || null, folder: job.folder || '', files: { a: fileView(job.fa), v: fileView(job.fv) } };
}
/* דיווח מהעובד → התקדמות חדשה. כל שלב מקבל זמן התחלה וסיום אמיתיים (המסך מציג "✓ 8 דק׳") */
function applyReport(job, r, now) {
  const prog = Object.assign({ st: '', p: 0, stg: {} }, job.prog || {});
  prog.stg = Object.assign({}, prog.stg);
  const closeCur = () => { if (prog.st && prog.stg[prog.st] && !prog.stg[prog.st].e) prog.stg[prog.st] = Object.assign({}, prog.stg[prog.st], { e: now }); };
  const st = STAGES.includes(r.st) ? r.st : '';
  if (st && st !== prog.st) {
    closeCur();
    prog.stg[st] = { s: now, e: 0 };
    prog.st = st; prog.p = 0; delete prog.eta;
  }
  if (r.p != null && Number.isFinite(+r.p)) prog.p = Math.max(0, Math.min(1, +r.p));
  if (r.msg != null) prog.msg = clean(r.msg, 240);
  if (r.ex != null) prog.ex = clean(r.ex, 240);
  if (r.eta != null && Number.isFinite(+r.eta)) prog.eta = Math.max(0, Math.min(48 * 3600, Math.round(+r.eta)));   // שניות שנשארו לשלב (העובד יודע הכי טוב)
  if (r.checks && typeof r.checks === 'object') prog.ck = { drive: r.checks.drive === true, server: true };
  prog.at = now;
  const out = { prog, updated: now };
  if (r.done === true) { closeCur(); prog.p = 1; out.state = 'done'; out.ended = now; }
  else if (r.fail === true) { closeCur(); out.state = 'failed'; out.err = ERR_RE.test(String(r.err || '')) ? r.err : 'worker'; out.ended = now; }
  return out;
}

/* ---------- Firestore (REST) ---------- */
const JSON_FIELDS = ['spec', 'fa', 'fv', 'sess', 'prog', 'fh'];
function toFields(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || k === 'id' || k.startsWith('_')) continue;
    if (JSON_FIELDS.includes(k)) out[k] = { stringValue: JSON.stringify(v == null ? null : v) };
    else if (typeof v === 'number') out[k] = { integerValue: String(Math.round(v)) };
    else if (typeof v === 'boolean') out[k] = { booleanValue: v };
    else if (v === null) out[k] = { nullValue: null };
    else out[k] = { stringValue: String(v) };
  }
  return out;
}
function fromFields(f) {
  const o = {};
  for (const [k, v] of Object.entries(f || {})) {
    if (!v || typeof v !== 'object') continue;
    if ('stringValue' in v) { if (JSON_FIELDS.includes(k)) { try { o[k] = JSON.parse(v.stringValue); } catch (e) { o[k] = null; } } else o[k] = v.stringValue; }
    else if ('integerValue' in v) o[k] = +v.integerValue;
    else if ('doubleValue' in v) o[k] = +v.doubleValue;
    else if ('booleanValue' in v) o[k] = !!v.booleanValue;
    else o[k] = null;
  }
  return o;
}

module.exports = {
  ROUTINE_URL_RE, ROUTINE_KEY_RE, JOB_RE, KEY_RE, FILE_ID_RE, KEY_TTL, STAGES, FINAL, ACTIVE, KINDS, WORKER_KINDS,
  MAX_ACTIVE, MAX_STORED, FIRE_HOUR, TEST_GAP,
  normRoutine, hintOf, normSpec, normFile, newJobId, newKey, keyHash, keyMatches, fireText, fireError, fireSession, recentFires,
  effState, publicJob, workerJob, applyReport, toFields, fromFields,
};
