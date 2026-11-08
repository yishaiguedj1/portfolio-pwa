'use strict';
/* 8/11/2026 — שלב 3 בתוכנית העצמאות מ־Firebase: איחוד לפי אירוע במקום בדיקה קבועה (חיסכון במכסת Firestore).
   הרקע: השרת שלנו קרא את היומן snbChg כל 2 דקות (lib/ldbsync.js) — 30 קריאות בשעה גם כשאין שינוי (Firestore מחייב
   קריאה גם על שאילתה ריקה). כ־600–700 ביום, כל מה שנשאר מהמכסה. עכשיו מי שכותב ליומן (Vercel — lib/ldbchg.js stampFetch,
   והקמת שרת — tools/server-provision.js) שולח לשרת שלנו הודעה קצרה "שיניתי", והשרת מאחד רק אחריה (+ בעלייה ופעם בשעה).
   ההודעה: POST /api/ldbping (רק בשרת — SERVER_ONLY ב־server.js), גוף { v:1, t, n, s } — בלי תוכן ובלי מזהים:
     t — זמן (ms) · n — nonce אקראי · s — HMAC-SHA256 על 'snb-ldb-ping|v1|<פרויקט>|t|n', מפתח vault.derive('snb-ldb-ping/v1').
   אבטחה (docs/privacy.md, "מערכות משלנו"): השוואה בזמן קבוע, חלון זמן של דקה, nonce שכבר נראה נדחה (שידור חוזר), הגבלת
   קצב לכתובת ובכלל (לפני ה־HMAC), גוף קטן בלבד. הודעה תקפה רק מבקשת איחוד — היא לא מכניסה שום נתון; האיחוד עצמו קורא
   את היומן מ־Firestore בטוקן של השרת, כמו קודם. הכי גרוע שמי שמחזיק את המפתח יכול לעשות: לגרום לאיחודים (מרוככים).
   השולח — fire-and-forget: עד PING_MS, כל תקלה נבלעת, ואחרי תקלה לא שולחים OPEN_MS (השרת למטה — לא מעכבים כל כתיבה). */
const crypto = require('crypto');

const LABEL = 'snb-ldb-ping/v1';
const WIN_MS = 60e3;                  // חלון הזמן (לשני הכיוונים — שעון של Vercel מול שלנו)
const PING_MS = 1500, OPEN_MS = 20e3; // השולח: זמן מרבי להודעה, והפסקה אחרי תקלה
const IP_MAX = 30, ALL_MAX = 240;     // הגבלת קצב לדקה: לכתובת, ובסך הכל
const NONCE_RE = /^[A-Za-z0-9_-]{16,64}$/, SIG_RE = /^[0-9a-f]{64}$/;
/* לאן שולחים — לפי הפרויקט (כמו RELAY_HUB ב־api/studio.js). SNB_LDB_PING_URL גובר; 'off' = לא שולחים */
const HUBS = { 'yishaiguedj1-c786e': 'https://api.thesnowball.app', 'snowball-staging-758f6': 'https://api-staging.thesnowball.app' };

const keyOf = () => { try { const d = require('./vault').derive(LABEL); return d ? d.key : null; } catch (e) { return null; } };
const msg = (project, t, n) => 'snb-ldb-ping|v1|' + project + '|' + t + '|' + n;
const sign = (key, project, t, n) => crypto.createHmac('sha256', key).update(msg(project, t, n)).digest('hex');
const b64u = (b) => b.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/* גוף חתום להודעה */
function make(key, project, now = Date.now()) {
  const t = Math.round(now), n = b64u(crypto.randomBytes(18));
  return { v: 1, t, n, s: sign(key, project, t, n) };
}
function hubOf(project, env = process.env) {
  const o = String(env.SNB_LDB_PING_URL || '').trim();
  if (o === 'off') return '';
  if (o) return /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o.replace(/\/+$/, '')) ? o.replace(/\/+$/, '') : '';
  return HUBS[project] || '';
}

/* ---------------------------------------------------------------- השולח (Vercel, הקמת שרת) */
const snd = { inflight: null, again: null, openUntil: 0, sent: 0, fail: 0 };
async function sendOnce(o) {
  const now = o.now || Date.now;
  if (now() < snd.openUntil) return false;
  const key = o.key !== undefined ? o.key : keyOf();
  const hub = o.hub !== undefined ? o.hub : hubOf(o.project, o.env);
  if (!key || !hub || !o.project) return false;
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const tm = ac ? setTimeout(() => ac.abort(), o.ms || PING_MS) : null;
  if (tm && tm.unref) tm.unref();
  try {
    const r = await o.fetch(hub + '/api/ldbping', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(make(key, o.project, now())), signal: ac ? ac.signal : undefined });
    if (!r || r.status !== 202) throw new Error('http_' + (r && r.status));
    snd.sent++;
    return true;
  } catch (e) {
    snd.fail++;
    snd.openUntil = now() + OPEN_MS;
    return false;
  } finally { if (tm) clearTimeout(tm); }
}
/* o = { fetch, project, env?, key?, hub?, now?, ms? } → Promise<bool>, לעולם לא נדחית.
   כמה כתיבות ברצף באותו תהליך: הודעה אחת בדרך + לכל היותר אחת אחריה (שמכסה את כל מה שנכתב בינתיים) */
function send(o) {
  if (snd.inflight) {
    if (!snd.again) snd.again = snd.inflight.then(() => { snd.again = null; return send(o); });
    return snd.again;
  }
  snd.inflight = sendOnce(o).catch(() => false).finally(() => { snd.inflight = null; });
  return snd.inflight;
}

/* ---------------------------------------------------------------- המקבל (השרת שלנו) */
const R = { ok: 0, no: 0, why: {}, at: 0 };
const seen = new Map();   // nonce → עד מתי לזכור
const ipHits = new Map();
let allHits = [];
function deny(why) { R.no++; R.why[why] = (R.why[why] || 0) + 1; }
function limited(ip, now) {
  allHits = allHits.filter((t) => now - t < 60e3);
  const a = (ipHits.get(ip) || []).filter((t) => now - t < 60e3);
  if (ipHits.size > 5000) ipHits.clear();
  ipHits.set(ip, a);
  if (a.length >= IP_MAX || allHits.length >= ALL_MAX) return true;   // בהצפה המערכים לא גדלים
  a.push(now); allHits.push(now);
  return false;
}
/* בדיקת גוף: '' = תקין, אחרת הסיבה (קוד קצר) */
function check(body, key, project, now) {
  const b = body && typeof body === 'object' ? body : null;
  if (!b || b.v !== 1 || !Number.isSafeInteger(b.t) || typeof b.n !== 'string' || typeof b.s !== 'string' || !NONCE_RE.test(b.n) || !SIG_RE.test(b.s)) return 'form';
  const want = Buffer.from(sign(key, project, b.t, b.n), 'hex'), got = Buffer.from(b.s, 'hex');
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return 'sig';
  if (Math.abs(now - b.t) > WIN_MS) return 'old';
  for (const [k, exp] of seen) { if (exp > now) break; seen.delete(k); }   // לפי סדר ההכנסה — הישנים קודם
  if (seen.has(b.n)) return 'replay';
  seen.set(b.n, now + 2 * WIN_MS + 1);
  return '';
}

/* over = { now, key, project, kick } (בדיקות) */
function makeHandler(over = {}) {
  return async function handler(req, res) {
    const now = (over.now || Date.now)();
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ ok: false });
    const ip = String((req.headers || {})['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
    if (limited(ip, now)) { deny('rate'); return res.status(429).json({ ok: false }); }
    let len = 0;
    try { len = JSON.stringify(req.body || {}).length; } catch (e) { len = 1e9; }
    if (len > 512) { deny('form'); return res.status(413).json({ ok: false }); }
    const key = over.key !== undefined ? over.key : keyOf();
    if (!key) { deny('cfg'); return res.status(503).json({ ok: false }); }
    const project = String(over.project || process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e');
    const why = check(req.body, key, project, now);
    if (why) { deny(why); return res.status(401).json({ ok: false }); }   // תשובה אחידה — בלי לגלות למה
    R.ok++; R.at = now;
    try { (over.kick || (() => require('./ldbsync').kick()))(); } catch (e) {}
    return res.status(202).json({ ok: true });
  };
}
/* לסטטוס (GET /api/session → ldb.ping): מונים בלבד */
const view = () => ({ ok: R.ok, no: R.no, why: Object.keys(R.why).length ? Object.assign({}, R.why) : undefined, at: R.at ? new Date(R.at).toISOString() : '' });

module.exports = makeHandler();
Object.assign(module.exports, { makeHandler, make, sign, check, send, hubOf, view, LABEL, WIN_MS, IP_MAX, ALL_MAX, OPEN_MS, HUBS,
  _reset: () => { seen.clear(); ipHits.clear(); allHits = []; R.ok = 0; R.no = 0; R.why = {}; R.at = 0; Object.assign(snd, { inflight: null, again: null, openUntil: 0, sent: 0, fail: 0 }); } });
