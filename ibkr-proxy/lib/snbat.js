'use strict';
/* 7/11/2026 — שלב 2 בתוכנית העצמאות מ־Firebase, גל 3: אסימון גישה משלנו (docs/accounts.md, "הגלים").

   הטלפון מקבל מהעוגייה (lib/session.js: at / who / כניסה) אסימון חתום קצר מועד, ושולח אותו לשרתון במקום ה־ID token של
   Firebase. כך בקשות לשרת שלנו לא תלויות ב־Firebase. Vercel לא מקבל אותו (gauth.verifyIdToken דוחה) — שם Firebase בלבד.

   הכללים (docs/privacy.md, "מערכות משלנו"):
   - צורה: JWT עם כותרת קבועה {alg:HS256, typ:JWT, kid:snb-at/1}. כל כותרת אחרת (alg אחר, none, kid אחר) — נדחית.
   - המפתח: vault.derive('snb-at/v1') — HMAC-SHA256, תווית ייעודית. לא נרשם ולא נשמר.
   - בתוך האסימון: sub (uid), aud = snb:<אפליקציה>, app, iat, exp (15 דק׳), vs (מתי הונפקה העוגייה), p (הפרויקט),
     em (המיילים המאומתים של החשבון אצלנו — להרשאות לפי מייל, כמו email ב־ID token).
   - כל אימות: חתימה בזמן קבוע, iss, aud מול app ורשימת האפליקציות, exp/iat, הפרויקט, והביטול — vs ישן מה־vs של
     "התנתקות מכל המכשירים" (sessions/{uid}.vs) נדחה. תקלה בקריאת vs = נדחה (נכשל סגור).
   - רק כשהדגל דולק (accOn) ורק בשרת שלנו. כבוי → לא מונפק ולא מתקבל, וההתנהגות כמו היום. */
const crypto = require('crypto');

const KID = 'snb-at/1';
const ISS = 'snb-at';
const TTL = 15 * 60;                       // שניות
const HEAD = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: KID })).toString('base64')
  .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{1,20}$/;
const VS_TTL_MS = 10 * 60e3;              // מטמון ה־vs לאימות. ההתנתקות נכתבת באותו תהליך (session.writeVs) ומעדכנת אותו מיד

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const unb64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';
const APPS = () => require('./session').APPS.concat(['all']);

function keyOf(over) {
  if (over) return over;
  const d = require('./vault').derive('snb-at/v1');
  return d ? d.key : null;
}
const sign = (key, s) => crypto.createHmac('sha256', key).update(s).digest();

/* האם זה אסימון שלנו (לפי הכותרת בלבד — לא אימות) */
function isOurs(tok) {
  const p = String(tok || '').split('.');
  return p.length === 3 && p[0] === HEAD;
}

/* הנפקה. o: { uid, app, vs, em, now (ms), key? }. מחזיר { at, exp } או זורק */
function issue(o) {
  const key = keyOf(o.key);
  if (!key) throw new Error('not_configured');
  if (!UID_RE.test(String(o.uid || ''))) throw new Error('bad_uid');
  if (!APPS().includes(o.app)) throw new Error('bad_app');
  const now = Math.floor((o.now || Date.now()) / 1000);
  const em = (Array.isArray(o.em) ? o.em : []).map((e) => String(e).toLowerCase()).filter((e) => EMAIL_RE.test(e)).slice(0, 5);
  const c = { iss: ISS, sub: o.uid, aud: 'snb:' + o.app, app: o.app, iat: now, exp: now + TTL, vs: Math.floor(+o.vs || 0), p: PROJECT(), em };
  const body = b64url(JSON.stringify(c));
  return { at: HEAD + '.' + body + '.' + b64url(sign(key, HEAD + '.' + body)), exp: c.exp };
}

/* vs נוכחי — דרך session.readVs (המטמון המשותף), עם תוקף ארוך יותר לאימות */
async function defaultVs(uid, nowMs) {
  const S = require('./session');
  const G = require('./gauth');
  return S.readVs(uid, { now: () => nowMs, token: () => G.datastoreToken(), fetch }, VS_TTL_MS);
}

/* אימות. opts: { key?, now (ms), aud? (אפליקציה צפויה), project?, vs?(uid)→Promise<number> }.
   מחזיר משתמש בצורה של gauth.verifyIdToken, או זורק bad_token / expired / wrong_project / revoked */
async function verify(tok, opts = {}) {
  const parts = String(tok || '').split('.');
  if (parts.length !== 3 || tok.length > 2000 || parts[0] !== HEAD) throw new Error('bad_token');   // alg/kid קבועים
  const key = keyOf(opts.key);
  if (!key) throw new Error('bad_token');
  const want = sign(key, parts[0] + '.' + parts[1]);
  const got = unb64url(parts[2]);
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) throw new Error('bad_token');
  let c;
  try { c = JSON.parse(unb64url(parts[1]).toString('utf8')); } catch (e) { throw new Error('bad_token'); }
  if (!c || c.iss !== ISS || !UID_RE.test(String(c.sub || ''))) throw new Error('bad_token');
  if (!APPS().includes(c.app) || c.aud !== 'snb:' + c.app) throw new Error('bad_token');
  if (opts.aud && opts.aud !== 'all' && c.app !== opts.aud) throw new Error('bad_token');
  if (c.p !== (opts.project || PROJECT())) throw new Error('wrong_project');
  const nowMs = opts.now || Date.now();
  const now = Math.floor(nowMs / 1000);
  if (!(c.exp > now) || !(c.iat > 0) || c.iat > now + 60 || c.exp - c.iat > TTL) throw new Error('expired');
  if (!(c.vs > 0)) throw new Error('bad_token');
  let cur;
  try { cur = await (opts.vs ? opts.vs(c.sub) : defaultVs(c.sub, nowMs)); } catch (e) { throw new Error('revoked'); }
  if (c.vs < (+cur || 0)) throw new Error('revoked');
  const em = (Array.isArray(c.em) ? c.em : []).filter((e) => typeof e === 'string' && EMAIL_RE.test(e));
  return { uid: c.sub, email: em[0] || '', name: '', verified: !!em[0], authTime: c.vs, provider: 'snb', app: c.app,
    gsubs: [], linked: em.slice(1), own: true };
}

module.exports = { issue, verify, isOurs, KID, TTL, HEAD, VS_TTL_MS };
