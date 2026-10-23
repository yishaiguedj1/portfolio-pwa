'use strict';
/* ניטור השרתים (22/10/2026, בקשת המשתמש: "מוניטור בזמן אמת לכל שרת — מעבד, זיכרון, דיסק, תעבורה").
   טהור: בלי Firestore — ה־API שומר ומשתמש. כל 5 דק׳ הדופק מביא את המדדים; כאן נשמרת נקודה אחת לשרת (מספרים בלבד,
   בלי שמות קבצים ובלי תוכן). MON_KEYS זהה ב־admin-app.js (גרפים) ובווידג׳ט באנדרואיד — שינוי כאן = גם שם. */
const crypto = require('crypto');

const MON_KEYS = ['t', 'cu', 'mem', 'disk', 'rx', 'tx', 'psi', 'nj'];   // זמן (שניות), מעבד %, זיכרון %, דיסק %, רשת B/s ×2, לחץ זיכרון %, עבודות במקביל
const MON_STEP = 4 * 60e3;   // נקודה לכל היותר פעם ב־4 דק׳ (הדופק כל 5 דק׳ — בלי כפילויות בין דופק לדופק)
const MON_MAX = 288;         // 24 שעות
const ALERT = { cu: 90, mem: 90, disk: 85, psi: 20 };   // סף "כתום" לכל מדד — מה שיוצא מעבר לו מסומן במסך ובווידג׳ט
const MON_TOK_RE = /^mon-[0-9a-f]{48}$/;

const num = (x, lo, hi, d) => (Number.isFinite(+x) && +x >= lo && +x <= hi ? Math.round(+x * d) / d : null);

/* נקודת היסטוריה אחת מהדופק (אחרי normHb). ערך שלא נמדד = null (לא 0 — גרף לא מציג "0%" על נתון חסר) */
function monPoint(hb, now) {
  hb = hb || {};
  return [Math.round(now / 1000), num(hb.cu, 0, 100, 10), num(hb.mem, 0, 100, 10), num(hb.disk, 0, 100, 10),
    num(hb.rx, 0, 1e12, 1), num(hb.tx, 0, 1e12, 1), num(hb.psi, 0, 100, 10), num(hb.nj, 0, 16, 1)];
}

/* מוסיף נקודה להיסטוריה של שרת (רשימה שמורה בשדה mon של המסמך). מחזיר את הרשימה החדשה, חתוכה ל־24 שעות */
function monPush(mon, hb, now) {
  const arr = (Array.isArray(mon) ? mon : []).filter((p) => Array.isArray(p) && p.length === MON_KEYS.length);
  const last = arr.length ? arr[arr.length - 1][0] * 1000 : 0;
  if (now - last < MON_STEP) return arr;
  arr.push(monPoint(hb, now));
  return arr.slice(-MON_MAX);
}

/* אילו מדדים חורגים מהסף עכשיו (מפתחות בלבד — הטקסט בטלפון) */
function monWarn(hb) {
  hb = hb || {};
  return Object.keys(ALERT).filter((k) => Number.isFinite(+hb[k]) && +hb[k] >= ALERT[k]);
}

/* תצוגת המוניטור: שרתים (עם ההיסטוריה ו־warn) + העבודות שרצות עכשיו על השרתים (שלב ואחוז — בלי מזהים) */
function monView(servers, jobs, now) {
  return {
    now,
    servers: (servers || []).map((s) => Object.assign({}, s, { warn: monWarn(s.hb), mon: (Array.isArray(s.mon) ? s.mon : []).slice(-MON_MAX) })),
    jobs: (jobs || []).map((j) => ({ sid: String(j.sid || '').slice(0, 24), st: String(j.st || '').slice(0, 24), p: num(j.p, 0, 1, 1000) }))
  };
}

/* טוקן קריאה בלבד לווידג׳ט: נוצר פעם אחת (מוצג פעם אחת), ונשמר רק ה־hash. ביטול = מחיקת ה־hash */
const monTokNew = () => 'mon-' + crypto.randomBytes(24).toString('hex');
const monTokHash = (tok) => crypto.createHash('sha256').update(String(tok)).digest('hex');
function monTokOk(tok, kh) {
  if (!MON_TOK_RE.test(String(tok || '')) || !/^[0-9a-f]{64}$/.test(String(kh || ''))) return false;
  const a = Buffer.from(monTokHash(tok), 'hex'), b = Buffer.from(String(kh), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { MON_KEYS, MON_STEP, MON_MAX, ALERT, monPoint, monPush, monWarn, monView, monTokNew, monTokHash, monTokOk, MON_TOK_RE };
