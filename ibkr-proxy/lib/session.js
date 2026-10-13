'use strict';
/* החיבור המשותף — "מחובר פעם אחת, מחובר בכולן" (שלב 2 בתוכנית שלוש האפליקציות, 13/10/2026).

   כמו accounts.google.com: עוגייה אחת על השרתון (api.thesnowball.app / api-staging.thesnowball.app), וכל אפליקציה
   שואלת אותו "מי מחובר?" ומקבלת טוקן מותאם של Firebase לאפליקציה שלה בלבד (טענת app), בלי חלון ובלי לחיצה.

   למה עוגייה חתומה משלנו ולא createSessionCookie של Firebase: אותה אבטחה (HMAC-SHA256, מפתח שנגזר מהמפתח הפרטי
   של חשבון השירות כמו הכספת), בלי תלות בהרשאת IAM נוספת, ונבדקת בלי רשת. ההתנתקות מכל המכשירים — בסימן זמן
   ב־Firestore (sessions/{uid}.vs): עוגייה שהונפקה לפניו לא תקפה.

   הכללים:
   - העוגייה __Host-snb_s: HttpOnly, Secure, SameSite=Strict, Path=/, בלי Domain — JavaScript לא רואה אותה, והיא
     נשלחת רק לשרתון עצמו. שבועיים, מתחדשת בשימוש (החלטה 2 בתוכנית).
   - רק מקורות מרשימה סגורה, ולכל סביבה שלה בלבד: הייצור לא מקבל את הניסוי (אותו "אתר" — thesnowball.app — ולכן
     הדפדפן כן היה שולח את העוגייה).
   - עוגייה נוצרת רק מהתחברות אמיתית עם Google בחמש הדקות האחרונות — לא מטוקן מותאם ולא מאסימון ישן.
   - הפעולות: login · who ("מי מחובר?" → ct = טוקן מותאם) · logout.
   - תקלה באחסון = לא מנפיקים טוקן (נכשל סגור). הטלפון מתנתק רק על תשובה מפורשת "אין חיבור". */
const crypto = require('crypto');
const G = require('./gauth');

const COOKIE = '__Host-snb_s';
const MAX_AGE = 14 * 24 * 3600;          // שבועיים (המקסימום של Firebase; החלטה 2)
const RENEW_AFTER = 24 * 3600;           // מתחדשת בשימוש — לכל היותר פעם ביום
const LOGIN_FRESH = 5 * 60;              // עוגייה רק מהתחברות של עד 5 דקות (ההמלצה של Firebase)
const TOKEN_TTL = 3600;                  // טוקן מותאם — שעה (המקסימום)
const VS_CACHE_MS = 30e3;
const AUD = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';
const APPS = ['invest', 'academy', 'studio', 'account'];
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const unb64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';

/* הסביבה: SNB_SESSION_ENV, אחרת לפי פרויקט ה־Firebase (הייצור = הפרויקט הראשי) */
function sessEnv(env) {
  const e = env || process.env;
  if (e.SNB_SESSION_ENV === 'prod' || e.SNB_SESSION_ENV === 'staging') return e.SNB_SESSION_ENV;
  return (e.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e') === 'yishaiguedj1-c786e' ? 'prod' : 'staging';
}

/* מקור → אפליקציה. רשימה סגורה; האתר המאוחד של היום (thesnowball.app / staging.thesnowball.app) = 'all'.
   הייצור: <אפליקציה>.thesnowball.app; הניסוי: <אפליקציה>-staging.thesnowball.app — ברמה הראשונה, כמו api-staging
   (התעודה החינמית של Cloudflare לא מכסה a.b.thesnowball.app; שלב 4, 13/10/2026) */
function appForOrigin(origin, envName) {
  const o = String(origin || '');
  const re = envName === 'staging'
    ? '^https://(?:(' + APPS.join('|') + ')-)?staging\\.thesnowball\\.app$'
    : '^https://(?:(' + APPS.join('|') + ')\\.)?thesnowball\\.app$';
  const m = new RegExp(re).exec(o);
  if (!m) return '';
  return m[1] || 'all';
}

/* ---------------------------------------------------------------- העוגייה */
function cookieKey(env) {
  const e = env || process.env;
  if (e.SNB_SESSION_KEY) {
    const k = Buffer.from(String(e.SNB_SESSION_KEY), 'base64');
    if (k.length >= 32) return k;
  }
  const sa = G.serviceAccount();
  if (!sa) return null;
  return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(sa.private_key), Buffer.from('snb-session/salt/v1'),
    Buffer.from('snb-session hmac v1|' + PROJECT()), 32));
}

function mac(key, s) { return b64url(crypto.createHmac('sha256', key).update(s).digest()); }

/* תוכן: u = uid, a = זמן ההתחברות עם Google, i = מתי הונפקה (לבדיקת ההתנתקות), x = תפוגה, p = הפרויקט */
function sealCookie(p, key) {
  const body = b64url(JSON.stringify(p));
  return 'v1.' + body + '.' + mac(key, 'v1.' + body);
}

function openCookie(v, key, now) {
  const parts = String(v || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || v.length > 600 || !key) return null;
  const want = mac(key, 'v1.' + parts[1]);
  const a = Buffer.from(want), b = Buffer.from(parts[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p;
  try { p = JSON.parse(unb64url(parts[1]).toString('utf8')); } catch (e) { return null; }
  if (!p || !UID_RE.test(String(p.u || '')) || !(p.x > now) || !(p.i > 0) || p.i > now + 300) return null;
  if (p.p !== PROJECT()) return null;
  return p;
}

function readCookie(req) {
  const raw = String((req.headers || {}).cookie || '');
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === COOKIE) return part.slice(i + 1).trim();
  }
  return '';
}

function setCookieHeader(value, maxAge) {
  return COOKIE + '=' + value + '; Path=/; Max-Age=' + maxAge + '; HttpOnly; Secure; SameSite=Strict';
}

/* ---------------------------------------------------------------- טוקן מותאם (custom token) */
function customToken(uid, app, now, sa) {
  if (!sa || !sa.client_email || !sa.private_key) throw new Error('no_sa');
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({
    iss: sa.client_email, sub: sa.client_email, aud: AUD, iat: now, exp: now + TOKEN_TTL,
    uid, claims: { app },
  }));
  const sig = b64url(crypto.sign('RSA-SHA256', Buffer.from(head + '.' + body), sa.private_key));
  return head + '.' + body + '.' + sig;
}

/* ---------------------------------------------------------------- ההתנתקות מכל המכשירים — sessions/{uid}.vs */
const vsCache = new Map();
const DOC = (uid) => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents/sessions/' + uid;

async function readVs(uid, deps) {
  const c = vsCache.get(uid);
  const now = deps.now();
  if (c && now - c.at < VS_CACHE_MS) return c.vs;
  const tk = await deps.token();
  const r = await deps.fetch(DOC(uid), { headers: { Authorization: 'Bearer ' + tk } });
  let vs = 0;
  if (r.status === 200) vs = +((((await r.json()).fields || {}).vs || {}).integerValue || 0) || 0;
  else if (r.status !== 404) throw new Error('fs_http_' + r.status);
  if (vsCache.size > 2000) vsCache.clear();
  vsCache.set(uid, { at: now, vs });
  return vs;
}

async function writeVs(uid, vs, deps) {
  const tk = await deps.token();
  const r = await deps.fetch(DOC(uid) + '?updateMask.fieldPaths=vs', {
    method: 'PATCH', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { vs: { integerValue: String(vs) } } }),
  });
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
  vsCache.set(uid, { at: deps.now(), vs });
}

/* ---------------------------------------------------------------- קצב (לכל כתובת) */
const hits = new Map();
function limited(ip, now) {
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60e3);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 60;
}

/* ---------------------------------------------------------------- הפונקציה */
function cors(res, origin, app) {
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!app) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
}

function makeHandler(over = {}) {
  return async function handler(req, res) {
    const deps = {
      fetch: over.fetch || fetch,
      now: over.now || Date.now,
      token: over.token || (() => G.datastoreToken(over.fetch)),
      verify: over.verify || ((t) => G.verifyIdToken(t, { fetch: over.fetch })),
      sa: over.sa || (() => G.serviceAccount()),
      env: over.env || process.env,
    };
    const h = req.headers || {};
    const origin = String(h.origin || '');
    const app = appForOrigin(origin, sessEnv(deps.env));
    cors(res, origin, app);
    if (!app) return res.status(403).json({ ok: false, error: 'forbidden_origin' });
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    let len = 0;
    try { len = JSON.stringify(body).length; } catch (e) { len = 1e9; }
    if (len > 8192) return res.status(413).json({ ok: false, error: 'too_large' });
    const nowMs = deps.now();
    const now = Math.floor(nowMs / 1000);
    const ip = String(h['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
    if (limited(ip, nowMs)) return res.status(429).json({ ok: false, error: 'rate' });
    const key = cookieKey(deps.env);
    if (!key) return res.status(503).json({ ok: false, error: 'not_configured' });
    const op = String(body.op || '');

    /* התחברות: אסימון Firebase טרי מהתחברות עם Google → עוגייה */
    if (op === 'login') {
      let u;
      try { u = await deps.verify(String(body.idToken || '')); } catch (e) { return res.status(401).json({ ok: false, error: 'bad_token' }); }
      if (!UID_RE.test(u.uid)) return res.status(401).json({ ok: false, error: 'bad_token' });
      if (u.provider === 'custom' || !(u.authTime > 0)) return res.status(403).json({ ok: false, error: 'not_fresh' });
      if (now - u.authTime > LOGIN_FRESH || u.authTime > now + 300) return res.status(403).json({ ok: false, error: 'not_fresh' });
      res.setHeader('Set-Cookie', setCookieHeader(sealCookie({ u: u.uid, a: u.authTime, i: now, x: now + MAX_AGE, p: PROJECT() }, key), MAX_AGE));
      return res.status(200).json({ ok: true });
    }

    const cur = openCookie(readCookie(req), key, now);

    /* "מי מחובר?" → טוקן מותאם לאפליקציה הזו (ct) */
    if (op === 'who') {
      if (!cur) {
        if (readCookie(req)) res.setHeader('Set-Cookie', setCookieHeader('', 0));
        return res.status(200).json({ ok: true, s: 0 });
      }
      let vs;
      try { vs = await readVs(cur.u, deps); } catch (e) { return res.status(503).json({ ok: false, error: 'store' }); }
      if (cur.i < vs) {
        res.setHeader('Set-Cookie', setCookieHeader('', 0));
        return res.status(200).json({ ok: true, s: 0 });
      }
      let tok;
      try { tok = customToken(cur.u, app, now, deps.sa()); } catch (e) { return res.status(503).json({ ok: false, error: 'not_configured' }); }
      if (now - cur.i > RENEW_AFTER) {
        res.setHeader('Set-Cookie', setCookieHeader(sealCookie({ u: cur.u, a: cur.a, i: now, x: now + MAX_AGE, p: PROJECT() }, key), MAX_AGE));
      }
      return res.status(200).json({ ok: true, s: 1, u: cur.u, app, ct: tok });
    }

    /* התנתקות: מהמכשיר (כל האפליקציות שבו — העוגייה משותפת), או מכל המכשירים (all) */
    if (op === 'logout') {
      res.setHeader('Set-Cookie', setCookieHeader('', 0));
      if (body.all && cur) {
        try { await writeVs(cur.u, now + 1, deps); } catch (e) { return res.status(503).json({ ok: false, error: 'store' }); }
      }
      return res.status(200).json({ ok: true, all: !!(body.all && cur) });
    }

    return res.status(400).json({ ok: false, error: 'bad_op' });
  };
}

module.exports = makeHandler();
Object.assign(module.exports, {
  makeHandler, appForOrigin, sessEnv, sealCookie, openCookie, cookieKey, customToken, readCookie, setCookieHeader,
  COOKIE, MAX_AGE, RENEW_AFTER, LOGIN_FRESH, TOKEN_TTL, APPS, AUD,
  _reset: () => { vsCache.clear(); hits.clear(); },
});
