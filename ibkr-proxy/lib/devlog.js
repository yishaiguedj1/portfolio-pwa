'use strict';
/* "איסוף מלא" בתקופת הפיתוח (15/10/2026, בקשת המשתמש — "רק אני משתמש"): מאחורי הדגל learn_full במרכז הניהול,
   לכבות כשיהיו משתמשים. רק מה שעוזר לשפר ולאבחן — בלי הסרטון המקורי, בלי נתוני Invest. טהור, בלי קריאות.
   מה נאסף:
     j — מהשרת (agent.py) בסוף כל עבודה / כשהיא תקועה: סוף הלוג, ה־traceback, מצב התהליכים (faulthandler + /proc),
         ויומן הקריאות ל־Claude (llm.py: זמן, stop_reason, ניסיון, request id, עלות)
     m — מהשרת: מדדי מעבד / זיכרון / דיסק פעם בדקה (נשלחים במנות), עם העבודה והשלב שרצים
     e — מהטלפון: שגיאות JavaScript (window.onerror / unhandledrejection) מ־Academy ו־Studio
   הכל מוצפן (lib/vault.js, AAD = dev|<המפתח>) בדלי של מאגר הלמידה (snb-learn), תחת d/<יום>/<סוג>/… — לא ב־Firestore,
   לא בריפו. נמחק אחרי KEEP_DAYS. הסודות נמחקים מהטקסט לפני השמירה (redact) — מפתח API, טוקנים, קישורים חתומים. */

const DL_V = 1;
const KEEP_DAYS = 30;
const KINDS = ['j', 'm', 'e'];
const TAIL_MAX = 200 * 1024, TB_MAX = 32 * 1024, STACK_MAX = 64 * 1024;
const PS_MAX = 60, CALLS_MAX = 3000, MET_MAX = 60, ERR_MAX = 20;
const BODY_MAX = 900 * 1024;          // devLog מהשרת — סוף הלוג + יומן הקריאות (JSON)
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const JOB_RE = /^j[A-Za-z0-9_-]{20}$/;
const ID_RE = /^[a-z0-9]{6,14}-[a-z0-9]{4,8}$/;
const KEY_RE = /^d\/(\d{4}-\d{2}-\d{2})\/(j|m|e)\/([A-Za-z0-9_-]{1,40})\.bin$/;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const num = (v, lo, hi, d) => (isNum(+v) && v !== null && v !== '' ? Math.max(lo, Math.min(hi, Math.round(+v * (d || 1)) / (d || 1))) : null);
const int = (v, lo, hi) => (Number.isInteger(+v) && v !== null && v !== '' ? Math.max(lo, Math.min(hi, +v)) : null);
const tok = (v, re, max) => (re.test(String(v == null ? '' : v)) ? String(v).slice(0, max) : '');
const dropEmpty = (o) => { for (const k of Object.keys(o)) if (o[k] === '' || o[k] == null) delete o[k]; return o; };

/* סודות שאסור שיישמרו גם בלוג של תקלה: מפתח Anthropic, Bearer, טוקן שרת (<12>-<43>), JWT, מפתח עבודה בשורת הפקודה,
   חתימות של קישורים (S3/R2, Google), access_token / refresh_token */
function redact(s) {
  return String(s == null ? '' : s)
    .replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, '⟨key⟩')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer ⟨tok⟩')
    .replace(/\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g, '⟨jwt⟩')
    .replace(/\b[A-Za-z0-9_-]{12}-[A-Za-z0-9_-]{43}\b/g, '⟨srv⟩')
    .replace(/(--key[ =])\S+/g, '$1⟨key⟩')
    .replace(/\b((?:key|token|access_token|refresh_token|code|secret|password|sig|signature|X-Amz-Signature|X-Amz-Credential|X-Goog-Signature)=)[^&\s"']+/gi, '$1⟨…⟩')
    .replace(/\b(ya29\.)[A-Za-z0-9._-]{10,}/g, '$1⟨…⟩')
    .replace(/"(key|token|secret|password|access_token|refresh_token|at)"\s*:\s*"[^"]{8,}"/gi, '"$1":"⟨…⟩"')
    // 25/10/2026: עוגיות של חשבון היוטיוב הייעודי (שורת cookies.txt או "שם=ערך") — לא נכנסות ליומן גם אם נדפסו בטעות
    .replace(/\b((?:__Secure-|__Host-)[A-Za-z0-9_-]+|SAPISID|APISID|HSID|SSID|SIDCC|SID|LOGIN_INFO|VISITOR_INFO1_LIVE|VISITOR_PRIVACY_METADATA|YSC|PREF)(=|\t)[^\s;"']+/g, '$1$2⟨…⟩');
}
/* טקסט חופשי: בלי תווי בקרה (חוץ משורה חדשה וטאב), בלי סודות, חתוך מהסוף (בלוג — הסוף חשוב יותר) */
function text(v, max, fromEnd) {
  let s = redact(String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ''));
  if (s.length > max) s = fromEnd ? '…' + s.slice(s.length - max) : s.slice(0, max) + '…';
  return s;
}

/* קריאה אחת ל־Claude (llm.py → calls.jsonl) */
function normCall(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const o = {
    t: num(c.t, 1.6e9, 4e9, 1000), ms: int(c.ms, 0, 7.2e6), k: tok(c.k, /^[a-z0-9_:-]{1,24}$/, 24), m: tok(c.m, /^claude-[a-z0-9-]{1,40}$/, 48),
    a: int(c.a, 0, 20), sr: tok(c.sr, /^[a-z_]{1,24}$/, 24), rid: tok(c.rid, /^[A-Za-z0-9_-]{6,80}$/, 80), mid: tok(c.mid, /^[A-Za-z0-9_-]{6,80}$/, 80),
    err: tok(c.err, /^[a-z_]{1,30}$/, 30), mt: int(c.mt, 0, 200000),
  };
  for (const f of ['i', 'o', 'cr', 'c5', 'c1', 'th']) { const n = int(c[f], 0, 5e6); if (n != null) o[f] = n; }
  const usd = num(c.usd, 0, 1000, 1e6); if (usd != null) o.usd = usd;
  if (typeof c.em === 'string' && c.em) o.em = text(c.em, 300);
  if (!o.t) return null;
  for (const k of Object.keys(o)) if (o[k] === '' || o[k] == null) delete o[k];
  return o;
}
/* תהליך אחד במצב השרת (מ־/proc): pid, שם, מצב, על מה הוא מחכה (wchan), זיכרון ומעבד */
function normPs(p) {
  if (!p || typeof p !== 'object') return null;
  const o = { pid: int(p.pid, 1, 4194304), cm: tok(p.cm, /^[\w.:@/+-]{1,40}$/, 40), s: tok(p.s, /^[A-Za-z]$/, 1), wc: tok(p.wc, /^[\w.]{1,48}$/, 48),
    rss: int(p.rss, 0, 1e9), cpu: num(p.cpu, 0, 1e7, 10), th: int(p.th, 0, 1e5) };
  if (!o.pid) return null;
  if (typeof p.cl === 'string') o.cl = text(p.cl, 300);   // שורת הפקודה — אחרי redact (בלי --key)
  for (const k of Object.keys(o)) if (o[k] === '' || o[k] == null) delete o[k];
  return o;
}
/* היומן של עבודה מהשרת. t = end (סוף עבודה) / stuck (תקועה — באמצע) / lost (21/10/2026: "קופסה שחורה" — הזנב שנשמר
   בדיסק כל דקה, נשלח בעלייה הבאה של הסוכן כשהשרת נפל באמצע; עד היום עבודה שקרסה לא השאירה שום יומן) */
function normJobLog(b) {
  if (!b || typeof b !== 'object' || !JOB_RE.test(String(b.job || ''))) return null;
  const o = { v: DL_V, job: b.job, t: b.t === 'stuck' || b.t === 'lost' ? b.t : 'end', at: int(b.at, 1.6e9, 4e9), rc: int(b.rc, -255, 255),
    st: tok(b.st, /^[a-z0-9_-]{1,24}$/, 24), p: num(b.p, 0, 1, 1000), dur: int(b.dur, 0, 1e6), idle: int(b.idle, 0, 1e6),
    ver: tok(b.ver, /^[0-9a-f]{7,40}$|^dev$/, 12) };
  if (typeof b.tail === 'string' && b.tail) o.tail = text(b.tail, TAIL_MAX, true);
  if (typeof b.tb === 'string' && b.tb) o.tb = text(b.tb, TB_MAX, true);
  if (typeof b.stack === 'string' && b.stack) o.stack = text(b.stack, STACK_MAX, true);
  if (Array.isArray(b.ps)) { const ps = b.ps.slice(0, PS_MAX).map(normPs).filter(Boolean); if (ps.length) o.ps = ps; }
  if (Array.isArray(b.calls)) { const cs = b.calls.slice(-CALLS_MAX).map(normCall).filter(Boolean); if (cs.length) o.calls = cs; }
  if (Array.isArray(b.tm)) {      // 21/10/2026: ציר הזמן של פקודות vt — [פקודה, התחלה, משך, תהליכון]; רק שמות ומספרים
    const tm = b.tm.slice(-200).map((x) => Array.isArray(x) && tok(x[0], /^[a-z][a-z_-]{1,19}$/, 20) && num(x[1], 1.6e9, 4e9, 10) && num(x[2], 0, 1e6, 100) != null
      ? [x[0], num(x[1], 1.6e9, 4e9, 10), num(x[2], 0, 1e6, 100), tok(x[3], /^[\w-]{1,12}$/, 12), int(x[4], 0, 1e7) || 0, int(x[5], 1, 16) || 1] : null).filter(Boolean);   // [4] = שיא זיכרון של הפקודה (MB), [5] = עבודות שרצו במקביל
    if (tm.length) o.tm = tm;
  }
  if (b.t === 'lost') o.lost = int(b.lost, 1.6e9, 4e9);
  for (const k of Object.keys(o)) if (o[k] === '' || o[k] == null) delete o[k];
  return o;
}
/* מדדים מהשרת — דגימה לדקה: מעבד (% מכל הליבות), זיכרון, דיסק, עומס, ומה רץ */
function normMet(b) {
  if (!b || typeof b !== 'object' || !Array.isArray(b.smp)) return null;
  const smp = [];
  for (const s of b.smp.slice(-MET_MAX)) {
    if (!s || typeof s !== 'object') continue;
    const o = { t: int(s.t, 1.6e9, 4e9), cpu: num(s.cpu, 0, 100, 10), mem: num(s.mem, 0, 100, 10), disk: num(s.disk, 0, 100, 10),
      free: num(s.free, 0, 1e5, 10), load: num(s.load, 0, 512, 100), rss: int(s.rss, 0, 1e9), io: int(s.io, 0, 1e12),
      j: tok(s.j, JOB_RE, 21), st: tok(s.st, /^[a-z0-9_-]{1,24}$/, 24), p: num(s.p, 0, 1, 1000),
      // 21/10/2026: בלי התקרה אי אפשר לתרגם "100%" ל־GB; במשבצות rss של העבודה היה תמיד 0 — עכשיו לכל משבצת
      mx: int(s.mx, 0, 1e7), av: int(s.av, 0, 1e7), psi: num(s.psi, 0, 100, 100),
      ma: int(s.ma, 0, 1e7), mf: int(s.mf, 0, 1e7), msh: int(s.msh, 0, 1e7),
      pq: int(s.pq, 0, 999), pqn: int(s.pqn, 0, 1e7) };   // 24/10/2026: בדיקות קישור — מה השרתון ענה לעובד, כמה טופלו   // memory.stat: anon / file (מטמון) / shmem — MB
    if (Array.isArray(s.sl)) {
      const sl = s.sl.slice(0, 4).map((x) => x && typeof x === 'object' && JOB_RE.test(String(x.j || '')) ? dropEmpty({
        j: x.j, st: tok(x.st, /^[a-z0-9_-]{1,24}$/, 24), p: num(x.p, 0, 1, 1000), rss: int(x.rss, 0, 1e7), cpu: num(x.cpu, 0, 1e4, 10) }) : null).filter(Boolean);
      if (sl.length) o.sl = sl;
    }
    if (Array.isArray(s.top)) {      // התהליכים הכבדים כשהזיכרון גבוה: רק שם התהליך (comm) ו־MB — בלי שורת פקודה
      const top = s.top.slice(0, 5).map((x) => x && typeof x === 'object' && tok(x.c, /^[\w.:@+-]{1,24}$/, 24) ? { c: x.c, r: int(x.r, 0, 1e7) } : null).filter(Boolean);
      if (top.length) o.top = top;
    }
    if (!o.t) continue;
    for (const k of Object.keys(o)) if (o[k] === '' || o[k] == null) delete o[k];
    smp.push(o);
  }
  if (!smp.length) return null;
  return { v: DL_V, ver: tok(b.ver, /^[0-9a-f]{7,40}$|^dev$/, 12) || undefined, cores: int(b.cores, 1, 1024) || undefined, smp };
}
/* שגיאות מהטלפון — עד ERR_MAX במנה */
const APPS = ['academy', 'studio', 'invest'];
function normErr(e) {
  if (!e || typeof e !== 'object') return null;
  const o = { ty: e.ty === 'rej' ? 'rej' : 'err', at: int(e.at, 1.6e12, 4e12), msg: text(e.msg, 500), src: text(e.src, 300),
    ln: int(e.ln, 0, 1e7), col: int(e.col, 0, 1e7), stk: text(e.stk, 4000), path: text(e.path, 200), n: int(e.n, 1, 1000) };
  if (!o.msg && !o.stk) return null;
  for (const k of Object.keys(o)) if (o[k] === '' || o[k] == null) delete o[k];
  return o;
}
function normErrs(b) {
  if (!b || typeof b !== 'object' || !APPS.includes(b.app) || !Array.isArray(b.errs)) return null;
  const errs = b.errs.slice(0, ERR_MAX).map(normErr).filter(Boolean);
  if (!errs.length) return null;
  return { v: DL_V, app: b.app, ver: text(b.ver, 24), ua: text(b.ua, 200), errs };
}

/* ---------- מפתחות בדלי ---------- */
const dayOf = (now) => new Date(now).toISOString().slice(0, 10);
function newId(now, rand) {
  return Math.floor(now).toString(36) + '-' + String(rand || '').replace(/[^a-z0-9]/g, '').slice(0, 8).padEnd(4, '0');
}
const dKey = (now, kind, id) => 'd/' + dayOf(now) + '/' + kind + '/' + id + '.bin';
function parseKey(k) {
  const m = KEY_RE.exec(String(k || ''));
  return m ? { day: m[1], kind: m[2], id: m[3] } : null;
}
/* היום הוותיק ביותר שעוד נשמר */
const oldestDay = (now) => dayOf(now - KEEP_DAYS * 864e5);
const expiredKey = (k, now) => { const p = parseKey(k); return !!p && p.day < oldestDay(now); };
/* הימים למשיכה (מהחדש לישן) */
function daysBack(now, days) {
  const out = [];
  for (let i = 0; i < Math.max(1, Math.min(KEEP_DAYS, days | 0)); i++) out.push(dayOf(now - i * 864e5));
  return out;
}

/* ---------- סיכום למשיכה ---------- */
function devStats(items) {
  const out = { j: 0, m: 0, e: 0, bytes: 0, days: {} };
  for (const it of items || []) {
    const p = parseKey(it.key);
    if (!p) continue;
    out[p.kind]++;
    out.bytes += it.size || 0;
    out.days[p.day] = (out.days[p.day] || 0) + 1;
  }
  return out;
}

/* ---------- תמונת העבודה מהשרתון (למאגר הלמידה במצב המלא) ---------- */
/* כל מה שיש ברשומת העבודה חוץ מסודות: hash של מפתח העבודה ותוקפו, סשן, קישורי העלאה, הבעלים */
const SNAP_DROP = new Set(['kh', 'kx', 'sess', 'uid', 'key', 'tok', 'token', 'secret', '_ut', 'pk', 'url', 'urls', 'u', 'rkh', 'pkh', 'pkx', 'pke']);   // 24/10/2026: מפתח ההעברה ומפתח הטלפון (hash / מוצפן) — לא נכנסים לאיסוף
function jobSnap(job, depth) {
  const d = depth || 0;
  if (d > 6) return null;
  if (Array.isArray(job)) return job.slice(0, 400).map((x) => jobSnap(x, d + 1));
  if (job && typeof job === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(job)) if (!SNAP_DROP.has(k)) o[k] = jobSnap(v, d + 1);
    return o;
  }
  if (typeof job === 'string') return text(job, 4000);
  return job;
}

module.exports = { DL_V, KEEP_DAYS, KINDS, BODY_MAX, ERR_MAX, APPS, redact, text, normCall, normPs, normJobLog, normMet, normErr, normErrs,
  dayOf, newId, dKey, parseKey, oldestDay, expiredKey, daysBack, devStats, jobSnap };
