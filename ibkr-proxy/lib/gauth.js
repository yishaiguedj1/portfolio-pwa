/* האקדמיה (שלב 2): אימות קוראים + גישה ל־Drive — בלי ספריות חיצוניות, רק crypto של Node.
   1) verifyIdToken — מאמת Firebase ID token (RS256) מול המפתחות הציבוריים של Google, ובודק aud/iss/exp
      מול פרויקט ה־Firebase של האפליקציה. כך השרתון יודע מי הקורא בלי לסמוך על מה שהטלפון "אומר".
   2) driveToken — חשבון שירות (מפתח JSON ב־GDRIVE_SA_KEY, משתנה סביבה ב־Vercel בלבד) → אסימון גישה
      לקריאה בלבד ל־Drive. החשבון רואה רק את התיקייה שהמשתמש שיתף איתו.
   שום מפתח לא נכתב לקוד או ללוגים. */
const crypto = require('crypto');

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const DEFAULT_PROJECT = 'yishaiguedj1-c786e'; // פרויקט ה־Firebase של האפליקציה (פומבי — firebase-config.js)
const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const unb64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

let certs = { at: 0, ttl: 0, keys: null };
async function googleCerts(fetchImpl) {
  const now = Date.now();
  if (certs.keys && now - certs.at < certs.ttl) return certs.keys;
  const r = await (fetchImpl || fetch)(CERTS_URL);
  if (r.status !== 200) throw new Error('certs_http_' + r.status);
  const m = String((r.headers && r.headers.get && r.headers.get('cache-control')) || '').match(/max-age=(\d+)/);
  certs = { at: now, ttl: Math.min(6 * 3600, m ? +m[1] : 3600) * 1000, keys: await r.json() };
  return certs.keys;
}

/* מחזיר { uid, email } או זורק שגיאה עם קוד קצר (bad_token / expired / wrong_project …) */
async function verifyIdToken(token, opts = {}) {
  const project = opts.project || process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT;
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || token.length > 4000) throw new Error('bad_token');
  let head, claims;
  try { head = JSON.parse(unb64url(parts[0])); claims = JSON.parse(unb64url(parts[1])); } catch (e) { throw new Error('bad_token'); }
  if (head.alg !== 'RS256' || !head.kid) throw new Error('bad_token');
  const keys = opts.keys || await googleCerts(opts.fetch);
  const pem = keys[head.kid];
  if (!pem) throw new Error('bad_token');
  const okSig = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), pem, unb64url(parts[2]));
  if (!okSig) throw new Error('bad_token');
  const now = Math.floor((opts.now || Date.now()) / 1000);
  if (claims.aud !== project || claims.iss !== 'https://securetoken.google.com/' + project) throw new Error('wrong_project');
  if (!(claims.exp > now) || claims.iat > now + 300) throw new Error('expired');
  if (!claims.sub) throw new Error('bad_token');
  return { uid: claims.sub, email: String(claims.email || '').toLowerCase(), verified: !!claims.email_verified };
}

/* רשימת הקוראים המורשים: LIBRARY_READERS = מיילים מופרדים בפסיק ("*" = כל משתמש מחובר) */
function readerAllowed(user, list, extra) {
  const raw = String(list == null ? process.env.LIBRARY_READERS || '' : list).toLowerCase();
  const set = raw.split(/[\s,;]+/).filter(Boolean);
  if (set.includes('*')) return true;
  return !!(user && user.email && user.verified && (set.includes(user.email) || (extra || []).includes(user.email)));
}

function serviceAccount() {
  let raw = process.env.GDRIVE_SA_KEY || '';
  if (!raw) return null;
  raw = raw.trim();
  if (!raw.startsWith('{')) { try { raw = Buffer.from(raw, 'base64').toString('utf8'); } catch (e) { return null; } }
  try {
    const sa = JSON.parse(raw);
    return sa.client_email && sa.private_key ? sa : null;
  } catch (e) { return null; }
}

const toks = {};   // scope → { v, exp }
async function saToken(scope, fetchImpl) {
  const now = Math.floor(Date.now() / 1000);
  const t = toks[scope];
  if (t && t.v && t.exp - 60 > now) return t.v;
  const sa = serviceAccount();
  if (!sa) throw new Error('not_configured');
  const aud = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: sa.client_email, scope, aud, iat: now, exp: now + 3600 }));
  const sig = b64url(crypto.sign('RSA-SHA256', Buffer.from(head + '.' + body), sa.private_key));
  const r = await (fetchImpl || fetch)(aud, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + body + '.' + sig,
  });
  if (r.status !== 200) throw new Error('sa_http_' + r.status);
  const j = await r.json();
  toks[scope] = { v: j.access_token, exp: now + (j.expires_in || 3600) };
  return j.access_token;
}
const driveToken = (f) => saToken('https://www.googleapis.com/auth/drive.readonly', f);
const datastoreToken = (f) => saToken('https://www.googleapis.com/auth/datastore', f);

/* שלב 6: מנהלי הספרייה — LIBRARY_ADMINS (מיילים), ואם לא הוגדר: המייל הראשון ב־LIBRARY_READERS */
const emails = (raw) => String(raw || '').toLowerCase().split(/[\s,;]+/).filter((x) => x && x !== '*');
function isAdmin(user) {
  if (!user || !user.email || !user.verified) return false;
  const admins = emails(process.env.LIBRARY_ADMINS);
  return (admins.length ? admins : emails(process.env.LIBRARY_READERS).slice(0, 1)).includes(user.email);
}
/* חתימה על רשימת הקוראים שנשמרת ב־Firestore — רק השרתון (שמחזיק את המפתח) יכול לייצר אותה,
   כך שגם אם חוקי Firestore מתירים כתיבה למשתמש, אי אפשר להוסיף את עצמך */
function signList(list) {
  const sa = serviceAccount(); if (!sa) return '';
  const key = crypto.createHash('sha256').update('snb-readers|' + sa.private_key).digest();
  return crypto.createHmac('sha256', key).update(JSON.stringify(list)).digest('hex');
}

module.exports = { verifyIdToken, readerAllowed, driveToken, datastoreToken, serviceAccount, isAdmin, signList, emails,
  _reset: () => { certs = { at: 0, ttl: 0, keys: null }; Object.keys(toks).forEach((k) => delete toks[k]); } };
