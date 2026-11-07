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
   - הפעולות: login · who ("מי מחובר?" → ct = טוקן מותאם) · logout · merge (מיזוג שני חשבונות, lib/acmerge.js) ·
     mailSend / mailCode (מיילים משלנו — כניסה בקוד או בקישור, איפוס, אימות; lib/mailer.js).
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
const APPS = ['invest', 'academy', 'studio', 'account', 'cashflow'];   // cashflow — גל 2 של Cashflow (6/11/2026)
/* מרכז הניהול (17/10/2026): admin[-staging].thesnowball.app — הפעולות שלו ב־/api/studio, ולכן מבחינת
   ההרשאות (appscope, הטענה app בטוקן) הוא Studio. לא אפליקציה חדשה: בלי מסמך משלו ובלי פעולות משלו */
const ALIAS = { admin: 'studio' };
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
    ? '^https://(?:(' + APPS.concat(Object.keys(ALIAS)).join('|') + ')-)?staging\\.thesnowball\\.app$'
    : '^https://(?:(' + APPS.concat(Object.keys(ALIAS)).join('|') + ')\\.)?thesnowball\\.app$';
  const m = new RegExp(re).exec(o);
  if (!m) return '';
  return ALIAS[m[1]] || m[1] || 'all';
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

/* חשבון השירות של השרתון (GDRIVE_SA_KEY) יכול להיות מפרויקט Google אחר — כך בייצור — ו־Firebase דוחה טוקן מותאם
   שלא נחתם בחשבון של הפרויקט שלו (auth/custom-token-mismatch; נמצא במוני האבחון 14/10/2026). אז החתימה בחשבון ייעודי
   בתוך פרויקט ה־Firebase — snb-session@<פרויקט> (בלי תפקידים) — דרך IAM Credentials ‏signBlob, בהרשאת "Service Account
   Token Creator" שניתנה עליו לחשבון של השרתון. בלי מפתח נוסף בשרת, והחשבון הזה לא יכול לעשות שום דבר חוץ מלחתום. */
const SIGNER = () => process.env.SNB_SESSION_SIGNER || ('snb-session@' + PROJECT() + '.iam.gserviceaccount.com');
async function mintToken(uid, app, now, deps) {
  const sa = deps.sa();
  if (!sa || !sa.client_email || !sa.private_key) throw new Error('no_sa');
  if (!sa.project_id || sa.project_id === PROJECT()) return customToken(uid, app, now, sa);
  const email = SIGNER();
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: email, sub: email, aud: AUD, iat: now, exp: now + TOKEN_TTL, uid, claims: { app } }));
  const tk = await deps.iamToken();
  const r = await deps.fetch('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/' + encodeURIComponent(email) + ':signBlob', {
    method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: Buffer.from(head + '.' + body).toString('base64') }),
  });
  if (r.status !== 200) throw new Error('sign_http_' + r.status);
  const j = await r.json();
  if (!j || !j.signedBlob) throw new Error('sign_empty');
  return head + '.' + body + '.' + b64url(Buffer.from(j.signedBlob, 'base64'));
}

/* ---------------------------------------------------------------- ההתנתקות מכל המכשירים — sessions/{uid}.vs */
const vsCache = new Map();
const DOC = (uid) => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents/sessions/' + uid;

async function readVs(uid, deps, ttl) {
  const c = vsCache.get(uid);
  const now = deps.now();
  if (c && now - c.at < (ttl || VS_CACHE_MS)) return c.vs;   // ttl ארוך יותר — לאימות האסימון שלנו (lib/snbat.js)
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

/* ---------------------------------------------------------------- מיילים משלנו (26/10/2026, lib/mailer.js + lib/fbadmin.js)
   mailSend: Firebase מייצר את הקישור (בלי לשלוח), אנחנו שולחים — עם קוד בן 6 ספרות לכניסה. mailCode: הקוד → oobCode,
   והטלפון נכנס איתו (signInWithEmailLink) — אותו חשבון Firebase, אותם מזהים. מסמך לכל מייל ב־authCodes/<hmac של המייל>:
   הקוד רק כ־HMAC, ה־oobCode מוצפן, 10 דקות, 5 ניסיונות, עד 5 שליחות בשעה למייל ו־10 לכתובת. תשובה זהה כשאין משתמש (איפוס). */
const MAIL_CODE_MS = 10 * 60e3, MAIL_TRIES = 5, MAIL_SENDS = 5, MAIL_IP_MAX = 10;
const MAIL_KINDS = ['in', 'reset', 'verify'];
const PATH_RE = /^\/(?:[a-z][a-z-]{0,20}\.html)?$/;
const mailIp = new Map();
function mailIpLimited(ip, now) {
  const arr = (mailIp.get(ip) || []).filter((t) => now - t < 3600e3);
  if (arr.length >= MAIL_IP_MAX) return true;
  arr.push(now); mailIp.set(ip, arr);
  if (mailIp.size > 5000) mailIp.clear();
  return false;
}
const hmacHex = (key, s) => crypto.createHmac('sha256', key).update(s).digest('hex');
function sealOc(key, id, oc) {
  const k = Buffer.from(crypto.hkdfSync('sha256', key, Buffer.from('snb-mail'), Buffer.from('oob|' + id), 32));
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const ct = Buffer.concat([c.update(oc, 'utf8'), c.final(), c.getAuthTag()]);
  return b64url(iv) + '.' + b64url(ct);
}
function openOc(key, id, s) {
  try {
    const [ivs, cts] = String(s || '').split('.');
    const k = Buffer.from(crypto.hkdfSync('sha256', key, Buffer.from('snb-mail'), Buffer.from('oob|' + id), 32));
    const iv = unb64url(ivs), all = unb64url(cts), d = crypto.createDecipheriv('aes-256-gcm', k, iv);
    d.setAuthTag(all.subarray(all.length - 16));
    return Buffer.concat([d.update(all.subarray(0, all.length - 16)), d.final()]).toString('utf8');
  } catch (e) { return ''; }
}
const CODES = (id) => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents/authCodes/' + id;
async function codeGet(deps, id) {
  const tk = await deps.token();
  const r = await deps.fetch(CODES(id), { headers: { Authorization: 'Bearer ' + tk } });
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
  const o = {};
  for (const [k, v] of Object.entries((await r.json()).fields || {})) o[k] = 'integerValue' in v ? +v.integerValue : v.stringValue;
  return o;
}
async function codePut(deps, id, o) {
  const tk = await deps.token(), f = {};
  for (const [k, v] of Object.entries(o)) f[k] = typeof v === 'number' ? { integerValue: String(Math.round(v)) } : { stringValue: String(v) };
  const r = await deps.fetch(CODES(id), { method: 'PATCH', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: f }) });
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
}
const sixDigits = () => String(crypto.randomInt(0, 1e6)).padStart(6, '0');

/* ---------------------------------------------------------------- אבחון (14/10/2026)
   מונים בלבד — בלי uid, מייל או עוגייה: איזה שלב הצליח ואיזה נכשל ובאיזה קוד, ו־20 האירועים האחרונים (זמן, קוד,
   אפליקציה). GET /api/session מחזיר אותם, כדי שאפשר יהיה לדעת מבחוץ למה החיבור המשותף לא עבד בטלפון. */
const stats = { since: Date.now(), n: {}, last: [] };
const CODE_RE = /[^a-z0-9_:/-]/g;
function tally(code, app) {
  const k = String(code).toLowerCase().replace(CODE_RE, '').slice(0, 60) || 'x';
  stats.n[k] = (stats.n[k] || 0) + 1;
  stats.last.push([new Date().toISOString().slice(0, 19), k, app || '']);
  if (stats.last.length > 20) stats.last.shift();
  if (Object.keys(stats.n).length > 100) stats.n = {};
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

/* ---------------------------------------------------------------- שלב 2: החשבונות אצלנו (6/11/2026, lib/accounts.js)
   דולק: SNB_ACC=on; כבוי: SNB_ACC=off; אחרת — בניסוי תמיד, בייצור לפי הדגל acc_srv במרכז הניהול (מהמסד, בלי קריאה) */
const ACC_OPS = ['accReg', 'gLogin', 'pwLogin', 'pwSet'];
function accOn(env) {
  if (env.SNB_ACC === 'off') return false;
  if (env.SNB_ACC === 'on' || sessEnv(env) === 'staging') return true;
  try { return require('./ldbsync').flag('acc_srv'); } catch (e) { return false; }
}
let accInst = null;
function accStore(fetchImpl, token) {
  if (accInst) return accInst;
  const V = require('./vault'), FA = require('./fbadmin');
  const d = V.derive('snb-acc-ix/v1');
  if (!d) throw new Error('vault_not_configured');
  accInst = require('./accounts').make({ fetch: fetchImpl, token, seal: V.seal, open: V.open, ixKey: d.key,
    fb: { byEmail: (e) => FA.lookup({ fetch: fetchImpl }, { email: e }), byGoogle: (sub) => FA.lookup({ fetch: fetchImpl }, { gsub: sub }),
      pwAt: (uid) => FA.lookup({ fetch: fetchImpl }, { uid }).then((a) => (a ? a.pu : 0)) } });   // גל 3: סיסמה שהוחלפה ב־Firebase
  return accInst;
}
/* הרישום השקט — לא מפיל את הבקשה. מחזיר false רק בתקלה */
async function observe(deps, u, app) {
  if (!deps.accOn()) return null;
  try { const r = await deps.acc().observe(Object.assign({}, u, { emails: G.emailsOf(u) })); if (r) tally('acc:reg', app); return true; }
  catch (e) { tally('acc:reg:store', app); return false; }
}
/* הקוד מחלון ההסכמה → אסימון זהות של Google. הלקוח של Drive (GDRIVE_CLIENT_ID) — כתובות החזרה שלו כבר רשומות */
const REDIRECT_OK = (r) => { try { return require('./gdrive').REDIRECT_RE.test(r); } catch (e) { return false; } };
const NONCE_RE = /^[A-Za-z0-9_-]{16,128}$/, CV_RE = /^[A-Za-z0-9._~-]{43,128}$/;
async function googleExchange(fetchImpl, code, redirect, cv) {
  const id = String(process.env.GDRIVE_CLIENT_ID || '').trim(), secret = String(process.env.GDRIVE_CLIENT_SECRET || '').trim();
  if (!id || !secret) throw new Error('not_configured');
  const p = { code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: 'authorization_code' };
  if (cv) p.code_verifier = cv;
  const r = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: Object.entries(p).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&') });
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (r.status !== 200 || !j.id_token) throw new Error('exchange_' + r.status);
  return { idToken: String(j.id_token), aud: id };   // את אסימון הגישה לא שומרים (openid email profile בלבד)
}
/* גל 3 (7/11/2026, lib/snbat.js): אסימון גישה משלנו מהעוגייה — רק כשדולק, ורק לחשבון שרשום אצלנו (המיילים המאומתים שלו
   נכנסים לאסימון, להרשאות לפי מייל). כל תקלה = בלי אסימון, והטלפון ממשיך עם getIdToken */
async function ownAt(deps, uid, vs, app) {
  if (!deps.accOn()) return {};
  try {
    const rec = await deps.acc().get(uid);
    if (!rec) { tally('at:no_acc', app); return {}; }
    const r = deps.issue({ uid, app, vs, em: rec.em, now: deps.now() });
    return { at: r.at, atx: r.exp };
  } catch (e) { tally('at:off', app); return {}; }
}
const PW_WIN = 15 * 60e3, PW_EMAIL_MAX = 5, PW_IP_MAX = 20;
const pwFails = new Map();
function pwFail(k, now) { const a = (pwFails.get(k) || []).filter((t) => now - t < PW_WIN); a.push(now); pwFails.set(k, a); if (pwFails.size > 20000) pwFails.clear(); }
const pwLocked = (k, now, max) => (pwFails.get(k) || []).filter((t) => now - t < PW_WIN).length >= max;

function makeHandler(over = {}) {
  return async function handler(req, res) {
    const deps = {
      fetch: over.fetch || fetch,
      now: over.now || Date.now,
      token: over.token || (() => G.datastoreToken(over.fetch)),
      verify: over.verify || ((t) => G.verifyIdToken(t, { fetch: over.fetch, own: false })),   // כאן רק Firebase: הכניסות דורשות התחברות אמיתית
      issue: over.issue || ((o) => require('./snbat').issue(o)),
      sa: over.sa || (() => G.serviceAccount()),
      iamToken: over.iamToken || (() => G.cloudToken(over.fetch)),
      env: over.env || process.env,
      mail: over.mail || ((m, now) => require('./mailer').send({ fetch: over.fetch || fetch, token: over.token || (() => G.datastoreToken(over.fetch)) }, m, now)),
      oob: over.oob || ((kind, email, url) => require('./fbadmin').oobLink({ fetch: over.fetch || fetch }, kind, email, url)),
      render: over.render || ((kind, lang, o) => require('./mailer').render(kind, lang, o)),
      mailRe: require('./mailer').EMAIL_RE,
      accOn: over.accOn || (() => accOn(over.env || process.env)),
      acc: over.acc || (() => accStore(over.fetch || fetch, over.token || (() => G.datastoreToken(over.fetch)))),
      gExchange: over.gExchange || ((code, redirect, cv) => googleExchange(over.fetch || fetch, code, redirect, cv)),
      merge: over.merge || ((from, to, keep) => require('./acmerge').mergeAccounts({ fetch: over.fetch || fetch, token: over.token || (() => G.datastoreToken(over.fetch)) }, from, to, keep)),
    };
    const h = req.headers || {};
    const origin = String(h.origin || '');
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      // 28/10/2026: fr = קריאות Firestore היום לפי פעולה (lib/fsmeter.js) — לאבחון מכסה בלי גישה ל־Google Cloud; רק שמות פעולות ומספרים
      return res.status(200).json({ ok: true, since: new Date(stats.since).toISOString(), n: stats.n, last: stats.last, fr: require('./fsmeter').view(), ldb: require('./ldbsync').status() });   // ldb — 5/11/2026: המסד שלנו (lib/ldbsync.js)
    }
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
      try { u = await deps.verify(String(body.idToken || '')); } catch (e) { tally('login:' + ((e && e.message) || 'bad_token'), app); return res.status(401).json({ ok: false, error: 'bad_token' }); }
      if (!UID_RE.test(u.uid)) { tally('login:uid', app); return res.status(401).json({ ok: false, error: 'bad_token' }); }
      await observe(deps, u, app);
      if (u.provider === 'custom' || !(u.authTime > 0)) { tally('login:not_fresh:' + (u.provider || 'none'), app); return res.status(403).json({ ok: false, error: 'not_fresh' }); }
      if (now - u.authTime > LOGIN_FRESH || u.authTime > now + 300) { tally('login:not_fresh:age', app); return res.status(403).json({ ok: false, error: 'not_fresh' }); }
      tally('login:ok', app);
      res.setHeader('Set-Cookie', setCookieHeader(sealCookie({ u: u.uid, a: u.authTime, i: now, x: now + MAX_AGE, p: PROJECT() }, key), MAX_AGE));
      return res.status(200).json({ ok: true });
    }

    const cur = openCookie(readCookie(req), key, now);
    /* עוגייה + טוקן מותאם (כגיבוי — הגישה הישירה ל־Firestore). אין טוקן (IAM לא זמין) — העוגייה תקפה, והטלפון ישאל who */
    const signIn = async (uid, tag) => {
      res.setHeader('Set-Cookie', setCookieHeader(sealCookie({ u: uid, a: now, i: now, x: now + MAX_AGE, p: PROJECT() }, key), MAX_AGE));
      let ct = '';
      try { ct = await mintToken(uid, app, now, deps); } catch (e) { tally(tag + ':ct_off', app); }
      tally(tag + ':ok', app);
      return res.status(200).json(Object.assign({ ok: true, s: 1, u: uid, app, ct }, await ownAt(deps, uid, now, app)));
    };

    /* ---- שלב 2 (6/11/2026, lib/accounts.js): החשבונות אצלנו. כבוי — off, והטלפון ממשיך עם Firebase ---- */
    /* גל 2 (7/11/2026): הטלפון שואל מראש אם לפתוח את החלון שלנו (אחרי await בלחיצה כבר אי אפשר לפתוח את של Firebase).
       מזהה הלקוח ציבורי (כמו gdConfig) — ורק כשדולק ומוגדר */
    if (op === 'gCfg') {
      const cid = String(process.env.GDRIVE_CLIENT_ID || '').trim(), on = !!(deps.accOn() && cid && String(process.env.GDRIVE_CLIENT_SECRET || '').trim());
      tally(on ? 'acc:gcfg:on' : 'acc:gcfg:off', app);
      return res.status(200).json({ ok: true, on, cid: on ? cid : '' });
    }
    if (ACC_OPS.includes(op) && !deps.accOn()) { tally('acc:off', app); return res.status(200).json({ ok: false, error: 'off' }); }
    /* רישום שקט: טוקן Firebase מאומת → החשבון נרשם אצלנו (אותו uid). הטלפון שולח פעם ביום */
    if (op === 'accReg') {
      let u;
      try { u = await deps.verify(String(body.idToken || '')); } catch (e) { tally('acc:reg:bad_token', app); return res.status(401).json({ ok: false, error: 'bad_token' }); }
      if (!UID_RE.test(u.uid)) return res.status(401).json({ ok: false, error: 'bad_token' });
      const r = await observe(deps, u, app);
      if (r === false) return res.status(503).json({ ok: false, error: 'store' });
      /* גל 3: pw = יש אצלנו סיסמה בתוקף (0 אחרי איפוס ב־Firebase — הטלפון ישלח pwSet בכניסה הבאה בסיסמה) */
      let pw = null;
      try { pw = await deps.acc().pwState(u.uid); } catch (e) { pw = null; }
      return res.status(200).json(pw === null ? { ok: true } : { ok: true, pw });
    }
    /* כניסה עם Google ישירות: הקוד מחלון ההסכמה (oauth.html, הלקוח של Drive — כבר רשום, בלי הגדרה חדשה) → השרת מחליף
       אותו מול Google, מאמת את האסימון (חתימה, aud, nonce) → החשבון שלנו → עוגייה + טוקן מותאם */
    if (op === 'gLogin') {
      const code = String(body.code || ''), redirect = String(body.redirect || ''), cv = String(body.cv || ''), nonce = String(body.nonce || '');
      if (!code || code.length > 2048 || !REDIRECT_OK(redirect) || !NONCE_RE.test(nonce) || (cv && !CV_RE.test(cv))) return res.status(400).json({ ok: false, error: 'bad_params' });
      let g;
      try { g = await deps.gExchange(code, redirect, cv); } catch (e) { tally('acc:g:' + String((e && e.message) || 'x').slice(0, 24), app); return res.status(401).json({ ok: false, error: 'bad_code' }); }
      let p;
      try { p = await require('./accounts').verifyGoogle(g.idToken, { aud: g.aud, nonce, fetch: deps.fetch, now: nowMs, keys: over.gKeys }); }
      catch (e) { tally('acc:g:' + String((e && e.message) || 'x').slice(0, 24), app); return res.status(401).json({ ok: false, error: 'bad_token' }); }
      let r;
      try { r = await deps.acc().loginGoogle(p); }
      catch (e) { const m = String((e && e.message) || ''); tally('acc:g:' + (m === 'unverified' ? 'unverified' : 'store'), app);
        return m === 'unverified' ? res.status(403).json({ ok: false, error: 'unverified' }) : res.status(503).json({ ok: false, error: 'store' }); }
      return signIn(r.uid, r.made ? 'acc:g:new' : 'acc:g');
    }
    /* כניסה עם סיסמה (רק סיסמאות שכבר אצלנו — pwSet). נעילה: 5 כישלונות ב־15 דק׳ למייל, 20 לכתובת. תשובה אחידה */
    if (op === 'pwLogin') {
      const email = String(body.email || '').trim().toLowerCase(), pw = typeof body.password === 'string' ? body.password : '';
      const eid = hmacHex(key, 'pw|' + email).slice(0, 24);
      if (pwLocked('e|' + eid, nowMs, PW_EMAIL_MAX) || pwLocked('i|' + ip, nowMs, PW_IP_MAX)) { tally('acc:pw:locked', app); return res.status(429).json({ ok: false, error: 'rate' }); }
      let uid = '';
      try { uid = await deps.acc().loginPw(email, pw); } catch (e) { tally('acc:pw:store', app); return res.status(503).json({ ok: false, error: 'store' }); }
      if (!uid) { pwFail('e|' + eid, nowMs); pwFail('i|' + ip, nowMs); tally('acc:pw:bad', app); return res.status(200).json({ ok: false, error: 'bad_login' }); }
      pwFails.delete('e|' + eid);
      return signIn(uid, 'acc:pw');
    }
    /* שמירת הסיסמה אצלנו — רק אחרי כניסה טרייה (עד 5 דק׳, לא טוקן מותאם), לחשבון של הטוקן בלבד */
    if (op === 'pwSet') {
      let u;
      try { u = await deps.verify(String(body.idToken || '')); } catch (e) { return res.status(401).json({ ok: false, error: 'bad_token' }); }
      if (!UID_RE.test(u.uid) || u.provider === 'custom' || !(u.authTime > 0) || now - u.authTime > LOGIN_FRESH || u.authTime > now + 300) { tally('acc:pwset:not_fresh', app); return res.status(403).json({ ok: false, error: 'not_fresh' }); }
      const pw = typeof body.password === 'string' ? body.password : '';
      if (!require('./accounts').pwValid(pw)) return res.status(400).json({ ok: false, error: 'bad_password' });
      try { await observe(deps, u, app); await deps.acc().setPw(u.uid, u.verified ? u.email : '', pw); } catch (e) { tally('acc:pwset:store', app); return res.status(503).json({ ok: false, error: 'store' }); }
      tally('acc:pwset:ok', app);
      return res.status(200).json({ ok: true });
    }

    /* "מי מחובר?" → טוקן מותאם לאפליקציה הזו (ct) */
    if (op === 'who') {
      if (!cur) {
        tally(readCookie(req) ? 'who:bad_cookie' : 'who:none', app);
        if (readCookie(req)) res.setHeader('Set-Cookie', setCookieHeader('', 0));
        return res.status(200).json({ ok: true, s: 0 });
      }
      let vs;
      try { vs = await readVs(cur.u, deps); } catch (e) { tally('who:store', app); return res.status(503).json({ ok: false, error: 'store' }); }
      if (cur.i < vs) {
        tally('who:logged_out', app);
        res.setHeader('Set-Cookie', setCookieHeader('', 0));
        return res.status(200).json({ ok: true, s: 0 });
      }
      let tok;
      try { tok = await mintToken(cur.u, app, now, deps); } catch (e) { tally('who:' + ((e && e.message) || 'sign'), app); return res.status(503).json({ ok: false, error: 'not_configured' }); }
      tally('who:ok', app);
      let vsNew = cur.i;
      if (now - cur.i > RENEW_AFTER) {
        res.setHeader('Set-Cookie', setCookieHeader(sealCookie({ u: cur.u, a: cur.a, i: now, x: now + MAX_AGE, p: PROJECT() }, key), MAX_AGE));
        vsNew = now;
      }
      return res.status(200).json(Object.assign({ ok: true, s: 1, u: cur.u, app, ct: tok }, await ownAt(deps, cur.u, vsNew, app)));
    }

    /* גל 3: חידוש האסימון שלנו מהעוגייה — בלי טוקן מותאם ובלי IAM. אין עוגייה / התנתק / כבוי → s:0 או off */
    if (op === 'at') {
      if (!deps.accOn()) { tally('at:flag_off', app); return res.status(200).json({ ok: false, error: 'off' }); }
      if (!cur) { tally('at:none', app); return res.status(200).json({ ok: true, s: 0 }); }
      let vs;
      try { vs = await readVs(cur.u, deps); } catch (e) { tally('at:store', app); return res.status(503).json({ ok: false, error: 'store' }); }
      if (cur.i < vs) { tally('at:logged_out', app); res.setHeader('Set-Cookie', setCookieHeader('', 0)); return res.status(200).json({ ok: true, s: 0 }); }
      const t = await ownAt(deps, cur.u, cur.i, app);
      if (!t.at) return res.status(503).json({ ok: false, error: 'not_configured' });
      tally('at:ok', app);
      return res.status(200).json(Object.assign({ ok: true, s: 1, u: cur.u, app }, t));
    }

    /* התנתקות: מהמכשיר (כל האפליקציות שבו — העוגייה משותפת), או מכל המכשירים (all) */
    if (op === 'logout') {
      tally(body.all ? 'logout:all' : 'logout', app);
      res.setHeader('Set-Cookie', setCookieHeader('', 0));
      if (body.all && cur) {
        try { await writeVs(cur.u, now + 1, deps); } catch (e) { return res.status(503).json({ ok: false, error: 'store' }); }
      }
      return res.status(200).json({ ok: true, all: !!(body.all && cur) });
    }

    /* מיזוג חשבונות (26/10/2026, lib/acmerge.js): המשתמש מחובר ב־A (כל סוג טוקן, גם מותאם) והוכיח שהוא מחזיק גם את B —
       טוקן של B מהתחברות אמיתית של עד 5 דקות (כמו login). הנתונים של B עוברים ל־A, והעוגיות של B מתבטלות.
       את B עצמו ב־Firebase הטלפון מוחק (user.delete() — אין לנו הרשאת מנהל על Auth), ואז מקשר את שיטת הכניסה ל־A */
    if (op === 'merge') {
      let a, b;
      try { a = await deps.verify(String(body.idToken || '')); b = await deps.verify(String(body.idTokenB || '')); } catch (e) { tally('merge:bad_token', app); return res.status(401).json({ ok: false, error: 'bad_token' }); }
      if (!UID_RE.test(a.uid) || !UID_RE.test(b.uid) || a.uid === b.uid) { tally('merge:uid', app); return res.status(400).json({ ok: false, error: 'bad_uid' }); }
      if (b.provider === 'custom' || !(b.authTime > 0) || now - b.authTime > LOGIN_FRESH || b.authTime > now + 300) { tally('merge:not_fresh', app); return res.status(403).json({ ok: false, error: 'not_fresh' }); }
      let r;
      try { r = await deps.merge(b.uid, a.uid, String(body.keep || 'both')); } catch (e) { tally('merge:store', app); return res.status(503).json({ ok: false, error: 'store' }); }
      if (r.busy) { tally('merge:busy', app); return res.status(409).json({ ok: false, error: 'busy' }); }
      try { await writeVs(b.uid, now + 1, deps); } catch (e) {}
      tally('merge:ok', app);
      return res.status(200).json({ ok: true, keep: r.keep, inv: r.inv, ac: r.ac, jobs: r.jobs, files: r.files, kept: r.kept, dropped: r.dropped });
    }

    /* שליחת מייל משלנו: כניסה (קוד + קישור), איפוס סיסמה, אימות מייל. נכשל → mail_off והטלפון שולח דרך Firebase */
    if (op === 'mailSend') {
      const kind = String(body.kind || ''), lang = body.lang === 'en' ? 'en' : 'he';
      const path = PATH_RE.test(String(body.path || '/')) ? String(body.path || '/') : '/';
      if (!MAIL_KINDS.includes(kind)) return res.status(400).json({ ok: false, error: 'bad_params' });
      let email = String(body.email || '').trim().toLowerCase();
      if (kind === 'verify') {
        let u;
        try { u = await deps.verify(String(body.idToken || '')); } catch (e) { return res.status(401).json({ ok: false, error: 'bad_token' }); }
        if (u.verified) return res.status(200).json({ ok: true, already: true });
        email = u.email;
      }
      if (!deps.mailRe.test(email)) return res.status(400).json({ ok: false, error: 'bad_email' });
      if (mailIpLimited(ip, nowMs)) { tally('mail:ip', app); return res.status(429).json({ ok: false, error: 'rate' }); }
      const id = hmacHex(key, 'mail|' + email).slice(0, 40);
      let rec = null;
      try { rec = await codeGet(deps, id); } catch (e) { tally('mail:store', app); return res.status(503).json({ ok: false, error: 'mail_off' }); }
      const win = rec && nowMs - (+rec.sw || 0) < 3600e3;
      if (win && (+rec.s || 0) >= MAIL_SENDS) { tally('mail:email_rate', app); return res.status(429).json({ ok: false, error: 'rate' }); }
      let L;
      try { L = await deps.oob(kind, email, origin + path); }
      catch (e) {
        if (String(e && e.message) === 'no_user' && kind === 'reset') { tally('mail:no_user', app); return res.status(200).json({ ok: true, sent: true }); }
        tally('mail:oob:' + String((e && e.message) || 'x').slice(0, 30), app);
        // שלב 2: Firebase לא הנפיק קישור — כניסה בקוד בלבד, והחשבון אצלנו (mailCode). אחרת — הטלפון שולח דרך Firebase
        if (kind !== 'in' || !deps.accOn()) return res.status(503).json({ ok: false, error: 'mail_off' });
        L = { link: '', oobCode: '' };
      }
      const code = kind === 'in' ? sixDigits() : '';
      const m = deps.render(kind, lang, { code, link: L.link });
      const sent = await deps.mail(Object.assign({ to: email }, m), nowMs).catch(() => ({ ok: false }));
      if (!sent.ok) { tally('mail:send:' + (sent.error || 'x'), app); return res.status(503).json({ ok: false, error: 'mail_off' }); }
      const next = { s: win ? (+rec.s || 0) + 1 : 1, sw: win ? +rec.sw : nowMs, at: nowMs };
      if (code) Object.assign(next, { h: hmacHex(key, 'code|' + id + '|' + code), oc: L.oobCode ? sealOc(key, id, L.oobCode) : '', x: nowMs + MAIL_CODE_MS, n: 0 });
      try { await codePut(deps, id, next); } catch (e) {}
      tally('mail:ok:' + kind + ':' + sent.via, app);
      return res.status(200).json({ ok: true, sent: true, code: !!code });
    }
    /* הקוד מהמייל → oobCode לכניסה. 5 ניסיונות, 10 דקות, שימוש אחד */
    if (op === 'mailCode') {
      const email = String(body.email || '').trim().toLowerCase(), code = String(body.code || '').replace(/\D/g, '');
      if (!deps.mailRe.test(email) || code.length !== 6) return res.status(400).json({ ok: false, error: 'bad_params' });
      const id = hmacHex(key, 'mail|' + email).slice(0, 40);
      let rec;
      try { rec = await codeGet(deps, id); } catch (e) { return res.status(503).json({ ok: false, error: 'store' }); }
      if (!rec || !rec.h || !(+rec.x > nowMs)) { tally('mailcode:expired', app); return res.status(200).json({ ok: false, error: 'expired' }); }
      if ((+rec.n || 0) >= MAIL_TRIES) { tally('mailcode:tries', app); return res.status(200).json({ ok: false, error: 'tries' }); }
      const want = Buffer.from(String(rec.h)), got = Buffer.from(hmacHex(key, 'code|' + id + '|' + code));
      if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) {
        try { await codePut(deps, id, Object.assign({}, rec, { n: (+rec.n || 0) + 1 })); } catch (e) {}
        tally('mailcode:bad', app); return res.status(200).json({ ok: false, error: 'bad_code', left: MAIL_TRIES - (+rec.n || 0) - 1 });
      }
      const oc = openOc(key, id, rec.oc);
      try { await codePut(deps, id, { s: +rec.s || 0, sw: +rec.sw || 0, at: nowMs }); } catch (e) {}   // שימוש אחד: הקוד וה־oobCode נמחקים
      /* גל 3: הוספת המייל לחשבון המחובר (add) — לא כניסה. רק עם עוגייה תקפה שלא בוטלה. oc נשאר: הטלפון מקשר גם ב־Firebase */
      if (body.add) {
        let added = '';
        if (deps.accOn() && cur) {
          try {
            const vs = await readVs(cur.u, deps);
            if (cur.i >= vs) { const r = await deps.acc().addEmail(cur.u, email); added = r.ok ? 'ok' : r.error || 'x'; }
            else added = 'logged_out';
          } catch (e) { added = 'store'; }
          tally('acc:add:' + added, app);
        }
        if (!oc && added !== 'ok') return res.status(200).json({ ok: false, error: added === 'in_use' ? 'in_use' : 'expired' });
        return res.status(200).json(Object.assign({ ok: true, added: added === 'ok' }, oc ? { oc } : {}));
      }
      /* שלב 2: הקוד הוכיח שהמייל שלו — החשבון אצלנו, עוגייה וטוקן מותאם. oc נשאר לגיבוי (הטלפון של היום נכנס איתו) */
      if (deps.accOn()) {
        let r = null;
        try { r = await deps.acc().loginEmail(email); } catch (e) { tally('acc:mail:store', app); }
        if (r && r.uid) {
          res.setHeader('Set-Cookie', setCookieHeader(sealCookie({ u: r.uid, a: now, i: now, x: now + MAX_AGE, p: PROJECT() }, key), MAX_AGE));
          let ct = '';
          try { ct = await mintToken(r.uid, app, now, deps); } catch (e) { tally('acc:mail:ct_off', app); }
          tally(r.made ? 'acc:mail:new' : 'acc:mail:ok', app);
          return res.status(200).json(Object.assign({ ok: true, s: 1, u: r.uid, app, ct }, await ownAt(deps, r.uid, now, app), oc ? { oc } : {}));
        }
      }
      if (!oc) return res.status(200).json({ ok: false, error: 'expired' });
      tally('mailcode:ok', app);
      return res.status(200).json({ ok: true, oc });
    }

    /* הטלפון מדווח שהטוקן המותאם נדחה ב־Firebase (רק הקוד של השגיאה) */
    if (op === 'note') {
      tally('client:' + String(body.c || ''), app);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: 'bad_op' });
  };
}

module.exports = makeHandler();
Object.assign(module.exports, {
  makeHandler, appForOrigin, sessEnv, readVs, sealCookie, openCookie, cookieKey, customToken, mintToken, readCookie, setCookieHeader,
  COOKIE, MAX_AGE, RENEW_AFTER, LOGIN_FRESH, TOKEN_TTL, APPS, AUD,
  accOn, ACC_OPS,
  _reset: () => { vsCache.clear(); hits.clear(); pwFails.clear(); accInst = null; },
});
