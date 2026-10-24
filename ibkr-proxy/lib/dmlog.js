'use strict';
/* מאגר הנתונים מ־Studio DM (24/10/2026, בקשת המשתמש — שלב ב׳): יומן ההורדות של DM (DmLog.kt) מגיע לכאן
   רק אחרי כניסה עם Google **והסכמה מפורשת** (גרסת הנוסח DMC_V — נוסח חדש שמרחיב מה נאסף = מספר חדש, גם ב־DmConsent.kt).
   מה נשמר: סוג האירוע, קוד הכשל, גודל, מהירות, חיבורים, ניסיונות, הדומיין ושם הקובץ, סוג החריגה, הודעה ושורות ERROR מנוקות.
   **אף פעם לא כתובת מלאה ולא עוגיות** — כאן נבדק שוב (רשימה מותרת + ניקוי), גם אם הטלפון כבר ניקה.
   אחסון: הדלי של המאגר (snb-learn), מוצפן (vault, AAD `dm|<key>`), `dm/u/<hash של uid>/<YYYY-MM>/<id>.bin` — כך "מחק את הנתונים שלי"
   = כל מה שמתחת לתיקייה של המשתמש, ו־24 חודשים כמו הקורפוס. טהור — בלי רשת. */
const crypto = require('crypto');
const DL = require('./devlog');

const DMC_V = 1;
const KEEP_MONTHS = 24;
const EV_MAX = 200;
const MSG_MAX = 300, TAIL_MAX = 12, NAME_MAX = 120;
const KINDS = new Set(['start', 'done', 'fail', 'stop']);
const TYPES = new Set(['http', 'yt']);
const ID_RE = /^[A-Za-z0-9_-]{4,40}$/;
const DOM_RE = /^[a-z0-9.-]{1,80}$/;
const CODE_RE = /^[a-z0-9_]{1,32}$/;
const EX_RE = /^[A-Za-z0-9_$]{1,60}$/;
const VER_RE = /^[0-9A-Za-z._ -]{1,40}$/;
const KEY_RE = /^dm\/u\/([0-9a-f]{16})\/(\d{4}-\d{2})\/([a-z0-9-]{6,40})\.bin$/;

const int = (v, lo, hi) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.max(lo, Math.min(hi, Math.round(+v))) : null);

/* טקסט חופשי מהטלפון: כתובת → <דומיין>, מיילים, אסימונים ארוכים, נתיבים — ואז הניקוי של האיסוף המלא (מפתחות, JWT, חתימות) */
function clean(s, max) {
  let x = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ');
  x = x.replace(/\b(?:https?|ftp|wss?):\/\/([^/\s?#'"<>]+)[^\s'"<>]*/gi, (m, h) => '<' + String(h).split('@').pop().toLowerCase() + '>');
  x = x.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>');
  x = x.replace(/\/(?:data|storage|sdcard)\/[^\s'"]*/g, (m) => '<path>/' + m.split('/').pop().slice(0, 60));
  x = DL.redact(x);
  x = x.replace(/\b(cookie|set-cookie|session|auth|expire|expires|policy)\s*[=:]\s*[^\s&;,'"]+/gi, '$1=<…>');
  x = x.replace(/[A-Za-z0-9_\-+/=]{32,}/g, '<…>').replace(/\s+/g, ' ').trim();
  return x.length > max ? x.slice(0, max) + '…' : x;
}

/* אירוע אחד — רשימה מותרת בלבד; לא תקין = null */
function normEv(e) {
  if (!e || typeof e !== 'object') return null;
  const k = String(e.k || ''), kind = String(e.kind || '');
  if (!KINDS.has(k) || !TYPES.has(kind) || !ID_RE.test(String(e.id || ''))) return null;
  const t = int(e.t, 0, 4e12);
  if (!t) return null;
  const o = { t, k, id: String(e.id), kind };
  const dom = String(e.dom || '').toLowerCase();
  if (DOM_RE.test(dom)) o.dom = dom;
  const name = clean(String(e.name || '').split('/').pop(), NAME_MAX);
  if (name) o.name = name;
  if (CODE_RE.test(String(e.code || ''))) o.code = String(e.code);
  const size = int(e.size, -1, 1e14); if (size != null && size >= 0) o.size = size;
  for (const [f, hi] of [['got', 1e14], ['ms', 864e6], ['bps', 1e11], ['conns', 32], ['tries', 999]]) {
    const v = int(e[f], 0, hi); if (v) o[f] = v;
  }
  if (EX_RE.test(String(e.ex || ''))) o.ex = String(e.ex);
  const msg = clean(e.msg, MSG_MAX); if (msg) o.msg = msg;
  if (Array.isArray(e.tail)) {
    const tl = e.tail.slice(-TAIL_MAX).map((l) => clean(l, MSG_MAX)).filter(Boolean);
    if (tl.length) o.tail = tl;
  }
  return o;
}

/* מנה מהטלפון: { cv, ev:[…], dev:{v, sdk, model} } → { dev, ev } או null (בלי הסכמה בנוסח הנוכחי / בלי אירוע תקין) */
function normBatch(b) {
  if (!b || +b.cv !== DMC_V || !Array.isArray(b.ev)) return null;
  const ev = b.ev.slice(-EV_MAX).map(normEv).filter(Boolean);
  if (!ev.length) return null;
  const d = b.dev && typeof b.dev === 'object' ? b.dev : {};
  const dev = {};
  if (VER_RE.test(String(d.v || ''))) dev.v = String(d.v);
  const sdk = int(d.sdk, 1, 99); if (sdk) dev.sdk = sdk;
  const model = clean(d.model, 60); if (model) dev.model = model;
  return { dev, ev };
}

/* הזהות בנתיב: hash של ה־uid עם מלח של המערכת — כך שמות הקבצים בדלי לא חושפים uid */
const uidHash = (uid, salt) => crypto.createHash('sha256').update('dm|' + String(salt || '') + '|' + String(uid)).digest('hex').slice(0, 16);
const monthOf = (now) => new Date(now).toISOString().slice(0, 7);
const userPrefix = (uid, salt) => 'dm/u/' + uidHash(uid, salt) + '/';
const dmKey = (uid, salt, now, id) => userPrefix(uid, salt) + monthOf(now) + '/' + id + '.bin';
function parseKey(k) { const m = KEY_RE.exec(String(k || '')); return m ? { u: m[1], month: m[2], id: m[3] } : null; }
/* נמחק אחרי KEEP_MONTHS חודשים מלאים */
function expiredKey(k, now) {
  const p = parseKey(k);
  if (!p) return false;
  const d = new Date(now); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - KEEP_MONTHS);
  return p.month < d.toISOString().slice(0, 7);
}

module.exports = { DMC_V, KEEP_MONTHS, EV_MAX, clean, normEv, normBatch, uidHash, userPrefix, dmKey, parseKey, expiredKey };
