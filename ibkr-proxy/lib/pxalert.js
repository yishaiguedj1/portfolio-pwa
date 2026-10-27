/* 27/10/2026 (בקשת המשתמש: "התראות מחיר ברקע — גם כשהאפליקציה סגורה לגמרי"): התראות המחיר של גרף הנרות נבדקות בשרתון.
   הטלפון שולח את ההתראות הפעילות + מנוי ה־Push של המכשיר (op:'pxa' ב־/api/ibkr-sync). מסמך לכל משתמש: pxAlerts/{uid}
   a = ההתראות הפעילות (JSON), f = מה שכבר נשלח {id: זמן} (JSON), w = מנויי Push (JSON), l = שפה. בלי שום נתון של התיק.
   הבודק (GET ?job=px) רץ בשרת שלנו כל 30 שנ׳ (server.js — startPx): מחיר אחד מ־Yahoo לכל הסימבולים יחד, ו־Push לכל התראה שנחצתה.
   כמו בגרף (chart.js — checkAlerts): חצייה של הרמה. המחיר הקודם — b (המחיר כשההתראה נוצרה/הוזזה) ואחר כך מה שנראה בבדיקה הקודמת.
   כל הפונקציות כאן טהורות — נבדקות בלי רשת. */
const SYM_RE = /^\^?[A-Z0-9][A-Z0-9.\-=^]{0,15}$/;
const ID_RE = /^[a-z0-9]{4,12}$/;
const MAX = 100;           // התראות פעילות למשתמש (בגרף — 20 לכל מניה)
const DIRS = ['cross', 'up', 'down'];

/* ההתראות מהטלפון → רשימה נקייה. כל מה שלא תקין — נזרק */
function norm(list) {
  const out = [], seen = new Set();
  for (const x of Array.isArray(list) ? list : []) {
    if (!x || typeof x !== 'object') continue;
    const i = String(x.i || ''), s = String(x.s || '').trim().toUpperCase(), p = +x.p, b = +x.b;
    if (!ID_RE.test(i) || seen.has(i) || !SYM_RE.test(s) || !(p > 0) || !isFinite(p) || !(b >= 0) || !isFinite(b)) continue;
    seen.add(i);
    out.push({ i, s, p, b, d: DIRS.includes(x.d) ? x.d : 'cross', n: String(x.n || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 80) });
    if (out.length >= MAX) break;
  }
  return out;
}

/* מה שכבר נשלח — רק של התראות שעוד קיימות (הטלפון מוחק / מחמש מחדש עם מזהה חדש) */
function pruneFired(f, alerts) {
  const ids = new Set(alerts.map((a) => a.i)), out = {};
  for (const [k, v] of Object.entries(f && typeof f === 'object' ? f : {})) if (ids.has(k) && +v > 0) out[k] = +v;
  return out;
}

/* המחיר להתראה — אותו מחיר שהגרף מציג (chart.js — parseQuote/quotePrice): במסחר הרגיל — הרגיל, בטרום/אחרי — המורחב */
function priceOf(x) {
  if (!x) return 0;
  const st = String(x.state || '').toUpperCase();
  if (st === 'REGULAR' && x.reg) return x.reg.p;
  const ext = st === 'PRE' ? x.pre : st === 'POST' || st === 'POSTPOST' ? x.post : (st === 'CLOSED' || st === 'PREPRE') ? x.night : null;
  if (ext && ext.p > 0) return ext.p;
  return x.reg ? x.reg.p : 0;
}

/* חצייה מ־prev ל־p — בדיוק כמו בגרף */
function crossed(a, prev, p) {
  if (!(prev > 0) || !(p > 0)) return false;
  const up = prev < a.p && p >= a.p, dn = prev > a.p && p <= a.p;
  return a.d === 'up' ? up : a.d === 'down' ? dn : up || dn;
}

/* בדיקה אחת. users: [{uid, a, f}] · px: {סימבול: מחיר} · last: Map של המחיר הקודם לכל התראה (uid|id) — מתעדכן כאן.
   מחזיר [{uid, hits:[{a, p}]}] */
function check(users, px, last) {
  const out = [];
  for (const u of users) {
    const hits = [];
    for (const a of u.a || []) {
      if (u.f && u.f[a.i]) continue;
      const p = px[a.s];
      if (!(p > 0)) continue;
      const k = u.uid + '|' + a.i, prev = last.has(k) ? last.get(k) : a.b;
      last.set(k, p);
      if (crossed(a, prev, p)) hits.push({ a, p });
    }
    if (hits.length) out.push({ uid: u.uid, hits });
  }
  if (last.size > 20000) last.clear();
  return out;
}

const dec = (v) => (v >= 1000 ? 2 : v >= 1 ? 2 : v >= 0.01 ? 4 : 8);
function fmt(v) { return Number(v).toLocaleString('en-US', { maximumFractionDigits: dec(v), minimumFractionDigits: v >= 1 ? 2 : 0 }); }
const TXT = {
  he: { cross: 'חצה את', up: 'עלה מעל', down: 'ירד מתחת ל־', now: 'עכשיו' },
  en: { cross: 'crossed', up: 'rose above', down: 'fell below', now: 'now' },
};
/* התוכן של ה־Push: כותרת = הסימבול, שורה = מה קרה + המחיר עכשיו + ההערה. u = הגרף של המניה */
function text(a, p, lang) {
  const T = TXT[lang] || TXT.he;
  const what = T[a.d] + (lang === 'en' || a.d !== 'down' ? ' ' : '') + fmt(a.p);
  return { t: '🔔 ' + a.s, b: (what + ' · ' + T.now + ' ' + fmt(p) + (a.n ? ' · ' + a.n : '')).slice(0, 160), u: '#chart=' + encodeURIComponent(a.s), i: a.i };
}

module.exports = { norm, pruneFired, priceOf, crossed, check, text, fmt, SYM_RE, ID_RE, MAX };
