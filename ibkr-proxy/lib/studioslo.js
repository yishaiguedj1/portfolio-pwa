/* v383: מגדל הפיקוח 2.0 — תקציב שגיאות (ServiceNow: Service Reliability Management · error budget · burn rate). טהור.
   היעד (SLO): 95% מעבודות התרגום מסתיימות בלי התערבות שלך, ב־30 הימים האחרונים. "תקציב השגיאות" = ה־5% שמותר שייכשלו;
   כמה ממנו נשאר, וקצב השריפה ב־7 הימים האחרונים (×1 = בדיוק בקצב; מעל — ייגמר לפני סוף החלון).
   - טובה: הסתיימה בלי "המשך" ידני. המשך אוטומטי אחרי תקלה חולפת (ar) = תיקון עצמי — לא התערבות.
   - אוכלת מהתקציב: נכשלה (גם אם ביטלת אחרי הכישלון), נתקעה, או הסתיימה אחרי "המשך" ידני.
   - לא נספרות: עבודה שביטלת (בלי כישלון), שנעצרה במתג החירום, ומה שעוד רץ. שאלות ואישורים — חלק מהתכנון, לא כישלון.
   נגזר מרשימת העבודות של op:'jobs' — בלי קריאה ובלי אחסון נוסף. */
const S = require('./studio');
const DAY = 86400e3;
const SLO_T = 0.95, WIN = 30 * DAY, FAST = 7 * DAY, MIN_N = 5, BAD_MAX = 10;

/* null = לא נספרת; אחרת { g: true } או { g: false, c: 'fail'|'stale'|'resume' } */
function classify(j, now) {
  if (!j || j.kind !== 'tr') return null;
  if (S.isStale(j, now)) return { g: false, c: 'stale', at: j.updated || 0 };
  const e = S.effState(j, now), st = e.state, err = e.err || j.err || '';   // effState: הופעלה ולא נלקחה = נכשלה
  const at = j.ended || j.updated || 0;
  if (st === 'failed') return err === 'halted' ? null : { g: false, c: 'fail', at };
  if (st === 'cancelled') return err && err !== 'halted' ? { g: false, c: 'fail', at } : null;
  if (st !== 'done') return null;
  const manual = Math.max(0, (j.fires || 1) - 1 - (j.ar || 0));
  return manual > 0 ? { g: false, c: 'resume', at } : { g: true, at };
}

function sloView(list, now) {
  const rows = (Array.isArray(list) ? list : []).map((j) => ({ j, x: classify(j, now) })).filter((r) => r.x && r.x.at && now - r.x.at <= WIN);
  const n = rows.length, bad = rows.filter((r) => !r.x.g);
  const allow = n * (1 - SLO_T);
  const used = allow > 0 ? bad.length / allow : 0;
  const r7 = rows.filter((r) => now - r.x.at <= FAST), b7 = r7.filter((r) => !r.x.g).length;
  const burn = r7.length ? Math.round(b7 / r7.length / (1 - SLO_T) * 10) / 10 : 0;
  const st = n < MIN_N ? 'few' : used >= 1 ? 'out' : burn >= 2 && b7 ? 'fast' : used >= 0.5 ? 'warn' : 'ok';
  return {
    t: Math.round(SLO_T * 100), n, good: n - bad.length, bad: bad.length,
    att: n ? Math.round((n - bad.length) / n * 1000) / 10 : null,
    left: Math.round(Math.max(0, 1 - used) * 100), burn, n7: r7.length, st, min: MIN_N,
    list: bad.sort((a, b) => b.x.at - a.x.at).slice(0, BAD_MAX).map((r) => ({ j: r.j.id, c: r.x.c, at: r.x.at })),
  };
}

module.exports = { SLO_T, WIN, FAST, MIN_N, BAD_MAX, classify, sloView };
