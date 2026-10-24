'use strict';
/* 24/10/2026 (בקשת המשתמש: "שהיישור והצריבה יהיו על השרת שלנו גם במצב Routine"): תור העברה בזיכרון של השרתון.
   העובד בשרת שלנו עושה את כל העבודה (הורדה, תמלול, יישור, צריבה), ורק הקריאות ל־Claude עוברות ל־Routine של המשתמש,
   שמריץ אותן ב־claude -p במנוי שלו. בלי Firestore (מכסת הקריאות) — התור חי בתהליך Node אחד של חדר האפליקציה
   (ibkr-proxy/server.js מדליק אותו ב־SNB_RELAY_HUB_ON). ב־Vercel אין תור (פונקציות קצרות) — השרתון עונה no_hub.

   מדיניות (התיעוד של Claude Code, legal-and-compliance): אסור לשמור או לתווך טוקן של מנוי — ולכן אין כאן טוקן.
   הקריאות רצות בבינארי הרשמי בתוך הסשן של המשתמש (ה־Routine שלו), על המנוי שלו, רק לעבודות שלו.

   בקשה: { rid, k, m, e, mt, fh, ex, pr } — מזהה (חוזר זהה בשליחה חוזרת), שלב, מודל, מאמץ, תקרת פלט, טביעת הבלוק הקבוע
   (sha1 של הטקסט), ההוראה שמשתנה והבקשה. הבלוק הקבוע עצמו נשלח פעם אחת לכל טביעה (fix), וה־Routine מקבל רק מה שאין לו (have).
   מצבים: q (בתור) → t (נלקחה) → s (Claude התחיל לענות — המטמון נכתב) → d (תשובה). נלקחה ולא נענתה TAKE_TTL → חוזרת לתור. */
const MAX_REQS = 64, MAX_TEXT = 3 * 1024 * 1024, MAX_JOBS = 50, MAX_BYTES = 256 * 1024 * 1024;
const TAKE_TTL = 50 * 60e3, DONE_TTL = 5 * 60e3, IDLE_TTL = 3 * 3600e3, WAIT_MAX = 25e3;
const RID_RE = /^[A-Za-z0-9_-]{8,40}$/, FH_RE = /^[0-9a-f]{20,40}$/, MODEL_RE = /^claude-[a-z0-9-]{1,50}$/;
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

function createHub(opt) {
  const now = (opt && opt.now) || (() => Date.now());
  const jobs = new Map();
  let bytes = 0;
  function J(id, make) {
    let j = jobs.get(id);
    if (!j && make) {
      gc();
      if (jobs.size >= MAX_JOBS) return null;
      j = { reqs: new Map(), fx: new Map(), seen: 0, at: now(), end: '', ww: new Set(), rw: new Set() };
      jobs.set(id, j);
    }
    if (j) j.at = now();
    return j;
  }
  function gc() {
    const t = now();
    for (const [id, j] of jobs) {
      if (t - j.at > IDLE_TTL) { drop(id); continue; }
      for (const r of [...j.reqs.values()]) {
        if (r.gone && t - r.gone > DONE_TTL) { j.reqs.delete(r.rid); bytes -= r.sz; }
        else if ((r.st === 't' || r.st === 's') && t - r.tk > TAKE_TTL) { r.st = 'q'; r.tk = 0; }
      }
    }
  }
  function drop(id) {
    const j = jobs.get(id);
    if (!j) return;
    for (const r of j.reqs.values()) bytes -= r.sz;
    for (const t of j.fx.values()) bytes -= t.length;
    jobs.delete(id);
    wake(j.ww); wake(j.rw);
  }
  function wake(set) { for (const f of set) f(); set.clear(); }
  const str = (v, n) => (typeof v === 'string' && v.length <= n ? v : null);

  /* העובד: בקשה חדשה (או אותה בקשה שוב — אחרי שהשרתון עלה מחדש, למשל). fx = הבלוק הקבוע, רק כשהתור ביקש אותו */
  function put(id, b) {
    const j = J(id, true);
    if (!j) return { ok: false, error: 'hub_full' };
    if (j.end) return { ok: false, error: 'ended' };
    const rid = String(b.rid || ''), fh = String(b.fh || '');
    if (!RID_RE.test(rid) || !FH_RE.test(fh) || !MODEL_RE.test(String(b.m || '')) || !EFFORTS.includes(b.e)) return { ok: false, error: 'bad_params' };
    if (j.reqs.has(rid)) return { ok: true, st: j.reqs.get(rid).st };
    if (j.reqs.size >= MAX_REQS) return { ok: false, error: 'hub_full' };
    if (!j.fx.has(fh)) return { ok: false, error: 'need_fixed' };
    const ex = str(b.ex == null ? '' : b.ex, MAX_TEXT), pr = str(b.pr, MAX_TEXT);
    if (ex == null || pr == null) return { ok: false, error: 'bad_params' };
    const mt = Math.max(256, Math.min(128000, Number(b.mt) | 0 || 32000));
    const sz = ex.length + pr.length;
    if (bytes + sz > MAX_BYTES) return { ok: false, error: 'hub_full' };
    bytes += sz;
    j.reqs.set(rid, { rid, k: String(b.k || '').slice(0, 8), m: b.m, e: b.e, mt, fh, ex, pr, st: 'q', at: now(), tk: 0, ans: null, sz });
    wake(j.rw);
    return { ok: true, st: 'q' };
  }

  /* העובד: הבלוק הקבוע (ההנחיה של המערכת) — בבקשה נפרדת, פעם אחת לכל טביעה, רק כשהתור ענה need_fixed.
     הטביעה נבדקת (sha1 של הטקסט) — אחרת אפשר היה לשתול טקסט תחת טביעה של בקשה אחרת */
  function fix(id, fh, fx) {
    const j = J(id, true);
    if (!j) return { ok: false, error: 'hub_full' };
    if (j.end) return { ok: false, error: 'ended' };
    fh = String(fh || '');
    const t = str(fx, MAX_TEXT);
    if (!FH_RE.test(fh) || t == null || !sha1(t).startsWith(fh)) return { ok: false, error: 'bad_params' };
    if (j.fx.has(fh)) return { ok: true };
    if (j.fx.size >= 16 || bytes + t.length > MAX_BYTES) return { ok: false, error: 'hub_full' };
    j.fx.set(fh, t); bytes += t.length;
    return { ok: true };
  }

  /* העובד: מחכה לתשובה (עד w מילישניות). unknown = השרתון עלה מחדש — שולחים את הבקשה שוב */
  function wait(id, rid, w) {
    const j = J(id, false);
    const r = j && j.reqs.get(String(rid || ''));
    const idle = () => (j && j.seen ? now() - j.seen : -1);   // כמה זמן ה־Routine לא שאל (‎-1 = עוד לא התחבר)
    if (!r) return Promise.resolve({ ok: true, st: j && j.end ? 'ended' : 'unknown', idle: idle() });
    const out = () => {
      const res = { ok: true, st: r.st, idle: idle() };
      if (r.st === 'd') {
        res.ans = r.ans;
        if (!r.gone) r.gone = now();                  // נמסר — יוצא מהזיכרון אחרי DONE_TTL (תשובה שאבדה בדרך נמסרת שוב, בלי לשלם שוב)
      }
      return res;
    };
    if (r.st === 'd') return Promise.resolve(out());
    const st0 = r.st;
    return new Promise((ok) => {
      let done = false;
      const fin = () => { if (done) return; done = true; clearTimeout(tm); j.ww.delete(f); ok(out()); };
      const f = () => { if (!jobs.has(id) || r.st !== st0 || r.st === 'd') fin(); else j.ww.add(f); };
      const tm = setTimeout(fin, Math.max(0, Math.min(WAIT_MAX, Number(w) || 0)));
      j.ww.add(f);
    });
  }

  /* ה־Routine: הבקשות שבתור (עד max), עם הבלוקים הקבועים שאין לו. מחכה עד w כשהתור ריק */
  function next(id, have, max, w) {
    const j = J(id, true);
    if (!j) return Promise.resolve({ ok: false, error: 'hub_full' });
    j.seen = now();
    const hv = new Set(Array.isArray(have) ? have.filter((x) => FH_RE.test(String(x))).slice(0, 64) : []);
    const take = () => {
      gc();
      const list = [], fx = {};
      for (const r of j.reqs.values()) {
        if (list.length >= Math.max(0, Math.min(8, max | 0))) break;
        if (r.st !== 'q') continue;
        r.st = 't'; r.tk = now();
        list.push({ rid: r.rid, k: r.k, m: r.m, e: r.e, mt: r.mt, fh: r.fh, ex: r.ex, pr: r.pr });
        if (!hv.has(r.fh) && !(r.fh in fx)) fx[r.fh] = j.fx.get(r.fh);
      }
      if (list.length) wake(j.ww);
      return { ok: true, reqs: list, fx, end: j.end || '' };
    };
    const first = take();
    if (first.reqs.length || first.end || !(max > 0)) return Promise.resolve(first);
    return new Promise((ok) => {
      let done = false;
      const fin = () => { if (done) return; done = true; clearTimeout(tm); j.rw.delete(f); j.seen = now(); ok(jobs.has(id) ? take() : { ok: true, reqs: [], fx: {}, end: 'gone' }); };
      const f = () => fin();
      const tm = setTimeout(fin, Math.max(0, Math.min(WAIT_MAX, Number(w) || 0)));
      j.rw.add(f);
    });
  }

  /* ה־Routine: Claude התחיל לענות (s), או התשובה (d). תשובה = טקסט + שימוש, או קוד שגיאה */
  function mark(id, rid, st, ans) {
    const j = J(id, false);
    const r = j && j.reqs.get(String(rid || ''));
    if (!r) return { ok: true, gone: true };
    j.seen = now();
    if (st === 's') { if (r.st === 't') { r.st = 's'; wake(j.ww); } return { ok: true }; }
    const a = normAns(ans);
    if (!a) return { ok: false, error: 'bad_params' };
    const sz = (a.t || '').length;
    bytes += sz; r.sz += sz;
    r.ans = a; r.st = 'd';
    wake(j.ww);
    return { ok: true };
  }

  /* סוף העבודה — ה־Routine מקבל end ויוצא; העובד שהסתיים כבר לא שולח */
  function end(id, why) {
    const j = J(id, true);
    if (!j) return { ok: false };
    j.end = String(why || 'done').slice(0, 20);
    wake(j.rw);
    setTimeout(() => drop(id), 5 * 60e3).unref?.();
    return { ok: true };
  }
  const stats = () => ({ jobs: jobs.size, bytes, reqs: [...jobs.values()].reduce((n, j) => n + j.reqs.size, 0) });
  return { put, fix, wait, next, mark, end, stats, _gc: gc };
}

const sha1 = (t) => require('crypto').createHash('sha1').update(t, 'utf8').digest('hex');
const ERR_RE = /^[a-z][a-z0-9_]{1,30}$/;
/* תשובה מה־Routine — טקסט מ־Claude (נתונים, כמו כל תשובה של מודל), שימוש במספרים בלבד, קוד שגיאה בצורה קבועה */
function normAns(a) {
  if (!a || typeof a !== 'object') return null;
  if (a.err != null) return ERR_RE.test(String(a.err)) ? { err: String(a.err) } : null;
  if (typeof a.t !== 'string' || a.t.length > MAX_TEXT) return null;
  const u = {};
  for (const f of ['i', 'o', 'cr', 'c5', 'c1']) {
    const v = Number(a.u && a.u[f]);
    u[f] = Number.isFinite(v) && v >= 0 && v < 1e9 ? Math.round(v) : 0;
  }
  const th = Number(a.th);
  const st = ['end_turn', 'max_tokens', 'refusal', 'stop_sequence', 'tool_use', 'pause_turn'].includes(a.st) ? a.st : 'end_turn';
  return { t: a.t, u, st, th: Number.isFinite(th) && th >= 0 && th < 1e9 ? Math.round(th) : 0 };
}

let _hub = null;
const hub = () => (process.env.SNB_RELAY_HUB_ON === '1' ? (_hub = _hub || createHub()) : null);

module.exports = { createHub, normAns, hub, RID_RE, FH_RE, MAX_TEXT, WAIT_MAX, TAKE_TTL };
