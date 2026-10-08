/* מגדל הפיקוח 2.0 — שלב א׳ (v365): אירועים, התראות, מפת השירות ובריאות הסטודיו. בהשראת ServiceNow Event Management + Service Health.
   כל מקור מדווח אירוע { c: רכיב, k: סוג } — העובד (vt, Drive), המגדל (חריג/עצירה), השרתון (הפעלה, נתקעה, לא נלקחה) והטלפון (העלאה).
   אירועים זהים (אותו רכיב · סוג · עבודה) מתאחדים להתראה אחת עם מונה; אירוע "ok" סוגר אותה. קטלוג קבוע בלבד — בלי טקסט חופשי,
   כך שאין כאן תוכן של המשתמש ואין דרך להזריק תוכן לטלפון. נשמר ב־studioOps/{uid} (נפרד מ־studioStats). הקובץ טהור — בלי רשת. */
const crypto = require('crypto');

/* מפת השירות — השרשרת של עבודת תרגום, לפי הסדר (הטלפון מצייר אותה כך) */
const COMPONENTS = ['phone', 'drive', 'server', 'routine', 'claude', 'vt'];
/* הקטלוג: "רכיב:סוג" → חומרה (1 = קריטי … 4 = מידע). סוג שלא כאן — נזרק */
const KINDS = {
  'phone:upload': 3, 'phone:stall': 3,
  'drive:up_retry': 4, 'drive:dl_retry': 4, 'drive:up_fail': 2, 'drive:dl_fail': 2, 'drive:auth': 2, 'drive:full': 2,
  'routine:fire': 2, 'routine:unsure': 3, 'routine:rate': 3, 'routine:no_claim': 2,
  'claude:stale': 2, 'claude:tw_warn': 3, 'claude:tw_stop': 2, 'claude:net': 2, 'claude:budget': 3,   // v367: הגענו לתקציב שקבעת — מחכה לך
  'claude:auto': 4,     // v368: המשכנו לבד אחרי תקלה חולפת (מידע — בסיכום היומי)
  'vt:setup': 2, 'vt:ingest': 2, 'vt:asr': 2, 'vt:align': 2, 'vt:check': 3, 'vt:render': 2, 'vt:other': 2,
};
const AL_MAX = 150, KEEP = 30 * 86400e3, GLOBAL_TTL = 30 * 60e3, EV_MAX = 6;
const PENALTY = { 1: 40, 2: 20, 3: 8, 4: 2 };
/* v368: התראות חכמות ושקט (ServiceNow: Flapping, Alert Priority Score, Exception rules, Email digests).
   מהבהבת = נסגרה ונפתחה שוב תוך שעה, פעמיים ומעלה (נפתחה 3 פעמים) — אותה רשומה נפתחת מחדש, לא חדשה.
   משקל רכיב: כמה עבודות תלויות בו (Routine/שרתון — כולן; vt — רק השלב שלו). השתקה — לסוג (רכיב · סוג), עם תפוגה, לכל היותר יום */
const FLAP_WIN = 60 * 60e3, FLAP_N = 2, DAY = 86400e3, MUTE_H = [1, 4, 24], MUTE_MAX = 20;
const WEIGHT = { routine: 5, server: 5, drive: 4, claude: 3, phone: 2, vt: 1 };
const JOB_RE = /^j[A-Za-z0-9_-]{20}$/;

const alertId = (c, k, j) => crypto.createHash('sha1').update(c + '|' + k + '|' + (j || '')).digest('hex').slice(0, 12);
/* אירועים מבחוץ (עובד / טלפון) — רק מהקטלוג, עד 6 בדיווח */
function normEvents(a) {
  const out = [];
  for (const e of (Array.isArray(a) ? a : [a]).slice(0, EV_MAX)) {
    if (!e || typeof e !== 'object') continue;
    const key = String(e.c || '') + ':' + String(e.k || '');
    if (!(key in KINDS)) continue;
    out.push({ c: String(e.c), k: String(e.k), ok: e.ok === true });
  }
  return out;
}
const isClosed = (a, now) => !!a.x || (!a.j && now - a.l > GLOBAL_TTL);   // התראה בלי עבודה נסגרת לבד אחרי חצי שעה בלי חזרה
const closedAt = (a) => a.x || a.l;
function alList(al, now) {
  return (Array.isArray(al) ? al : []).filter((a) => a && typeof a.id === 'string' && (a.c + ':' + a.k) in KINDS && (!isClosed(a, now) || now - closedAt(a) < KEEP));
}
/* אירועים → התראות. once = אירוע שהשרתון מעלה בכל צפייה (עבודה שנתקעה) — לא מגדיל את המונה */
function opsApply(al, evs, j, now, once) {
  const out = alList(al, now).map((a) => Object.assign({}, a));
  const job = JOB_RE.test(String(j || '')) ? j : '';
  let changed = false;
  for (const e of evs) {
    const id = alertId(e.c, e.k, job);
    const cur = out.find((a) => a.id === id && !isClosed(a, now));
    if (e.ok) { if (cur) { cur.x = now; changed = true; } continue; }
    if (cur) { if (!once) { cur.n += 1; cur.l = now; changed = true; } continue; }
    // v368: נסגרה לפני פחות משעה — אותה התראה נפתחת שוב (מונה פתיחות r); מ־FLAP_N פתיחות חוזרות — "מהבהבת"
    const prev = out.filter((a) => a.id === id && isClosed(a, now) && now - closedAt(a) < FLAP_WIN).pop();
    if (prev && !once) {
      prev.x = 0; prev.n += 1; prev.l = now; prev.r = (prev.r || 0) + 1;
      if (prev.r >= FLAP_N) prev.fl = 1;
      changed = true;
      continue;
    }
    out.push({ id, c: e.c, k: e.k, s: KINDS[e.c + ':' + e.k], j: job, n: 1, f: now, l: now, x: 0 });
    changed = true;
  }
  return changed ? out.slice(-AL_MAX) : null;
}
/* עבודה שהסתיימה / בוטלה / נמחקה — כל ההתראות שלה נסגרות */
function opsCloseJob(al, j, now) {
  const out = alList(al, now).map((a) => Object.assign({}, a));
  let changed = false;
  for (const a of out) if (a.j === j && !isClosed(a, now)) { a.x = now; changed = true; }
  return changed ? out : null;
}
/* איחוד מקטעי זמן (לחישוב זמינות) */
function unionMs(iv, from, to) {
  const s = iv.map(([a, b]) => [Math.max(a, from), Math.min(b, to)]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let tot = 0, cs = -1, ce = -1;
  for (const [a, b] of s) {
    if (a > ce) { if (ce > cs) tot += ce - cs; cs = a; ce = b; } else ce = Math.max(ce, b);
  }
  if (ce > cs) tot += ce - cs;
  return tot;
}
/* מה הטלפון רואה: ציון בריאות, זמינות 30 יום (התראות P1–P2 = "לא זמין"), זמן ממוצע לתיקון, מצב כל רכיב,
   וההתראות הפתוחות — מקובצות לפי רכיב ועבודה (הראשית = החמורה ביותר, השאר "קשורות") */
/* v368: השתקות בתוקף — { "רכיב:סוג": עד מתי }; פגה — נעלמת לבד (בלי השתקות נצחיות) */
function normMutes(mu, now) {
  const out = {};
  if (!mu || typeof mu !== 'object') return out;
  for (const [k, v] of Object.entries(mu)) if (k in KINDS && typeof v === 'number' && v > now && v <= now + DAY + 60e3) out[k] = v;
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, MUTE_MAX));
}
/* השתקה / ביטול (h = 0). רק סוג מהקטלוג ושעות מהרשימה — אחרת null */
function muteSet(mu, c, k, h, now) {
  const key = String(c) + ':' + String(k);
  if (!(key in KINDS) || !(h === 0 || MUTE_H.includes(h))) return null;
  const out = normMutes(mu, now);
  if (h) out[key] = now + h * 3600e3; else delete out[key];
  return out;
}
/* ציון עדיפות (כמו Alert Priority Score): עבודות שנפגעו › חומרה › משקל הרכיב › מופעים */
const priScore = (nj, s, c, n) => Math.max(1, nj) * 1e6 + (5 - s) * 1e5 + (WEIGHT[c] || 1) * 1e4 + Math.min(n, 9999);
function opsView(al, now, mu) {
  const list = alList(al, now);
  const mutes = normMutes(mu, now);
  const open = list.filter((a) => !isClosed(a, now));
  const from = now - KEEP;
  const iv = (c) => list.filter((a) => a.s <= 2 && (!c || a.c === c)).map((a) => [a.f, isClosed(a, now) ? closedAt(a) : now]);
  const pct = (ms) => Math.round(1000 * (1 - ms / KEEP)) / 10;
  const comp = {}, avail = {};
  for (const c of COMPONENTS) {
    const o = open.filter((a) => a.c === c);
    comp[c] = o.length ? Math.min(...o.map((a) => a.s)) : 0;
    avail[c] = pct(unionMs(iv(c), from, now));
  }
  const fixed = list.filter((a) => isClosed(a, now) && a.s <= 3 && closedAt(a) >= from);
  const mttr = fixed.length ? Math.round(fixed.reduce((s, a) => s + (closedAt(a) - a.f), 0) / fixed.length / 60e3) : null;
  // כמה עבודות נפגעו מאותו סוג (התראה בלי עבודה = אחת)
  const jobsOf = (key) => new Set(open.filter((a) => a.c + ':' + a.k === key).map((a) => a.j || '-')).size;
  const groups = new Map();
  for (const a of open.slice().sort((x, y) => x.s - y.s || y.l - x.l)) {
    const g = a.c + '|' + a.j;
    if (!groups.has(g)) groups.set(g, { id: a.id, c: a.c, k: a.k, s: a.s, j: a.j, n: a.n, f: a.f, l: a.l, rel: 0, fl: a.fl ? 1 : 0, r: a.r || 0 });
    else { const p = groups.get(g); p.rel += 1; p.n += a.n; p.l = Math.max(p.l, a.l); if (a.fl) p.fl = 1; }
  }
  const grp = Array.from(groups.values()).map((g) => {
    const key = g.c + ':' + g.k, nj = jobsOf(key);
    return Object.assign(g, { nj, ps: priScore(nj, g.s, g.c, g.n), m: mutes[key] || 0 });
  }).sort((x, y) => y.ps - x.ps || y.l - x.l);
  const score = Math.max(0, 100 - open.reduce((s, a) => s + (PENALTY[a.s] || 0), 0));   // השתקה לא מסתירה מהציון — רק מהרעש
  // סיכום 24 שעות (P3–P4 לא קופצות — הן כאן): כמה התראות היו פעילות, וחמשת הסוגים הנפוצים
  const day = list.filter((a) => a.l >= now - DAY);
  const kinds = new Map();
  for (const a of day.filter((x) => x.s >= 3)) { const key = a.c + ':' + a.k; kinds.set(key, (kinds.get(key) || 0) + a.n); }
  const digest = { hi: day.filter((a) => a.s <= 2).length, lo: day.filter((a) => a.s >= 3).length,
    top: Array.from(kinds.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key, n]) => ({ c: key.split(':')[0], k: key.split(':')[1], n })) };
  return { score, avail: pct(unionMs(iv(''), from, now)), mttr, comp, open: grp.slice(0, 20), closed30: fixed.length, digest,
    mu: Object.entries(mutes).map(([key, until]) => ({ c: key.split(':')[0], k: key.split(':')[1], until })) };
}
/* מגדל הפיקוח (v362) → אירועים: חריג = התראה P3 שנסגרת כשחוזר לתקין, עצירה = P2 */
function towerEvents(tw) {
  if (!tw) return [];
  if (tw.lv === 'red') return [{ c: 'claude', k: 'tw_warn', ok: true }, { c: 'claude', k: 'tw_stop' }];
  if (tw.lv === 'warn') return [{ c: 'claude', k: 'tw_warn' }];
  return [{ c: 'claude', k: 'tw_warn', ok: true }];
}
/* הפעלה שנכשלה (קוד השגיאה מ־fireError) → אירוע של ה־Routine */
function fireEvent(err) {
  if (!err || !/^routine_/.test(err)) return null;
  if (err === 'routine_rate') return { c: 'routine', k: 'rate' };
  if (err === 'routine_down' || err === 'routine_net') return { c: 'routine', k: 'unsure' };
  return { c: 'routine', k: 'fire' };
}

module.exports = { COMPONENTS, KINDS, AL_MAX, KEEP, GLOBAL_TTL, FLAP_WIN, FLAP_N, DAY, MUTE_H, WEIGHT, normMutes, muteSet, priScore, alertId, normEvents, opsApply, opsCloseJob, opsView, towerEvents, fireEvent, unionMs };
