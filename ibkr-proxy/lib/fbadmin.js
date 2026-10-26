'use strict';
/* פעולות מנהל ב־Firebase Auth בלי ספרייה (26/10/2026, שליחת מיילים משלנו — lib/mailer.js).
   accounts:sendOobCode עם returnOobLink — Firebase מחזיר את הקישור (כניסה / איפוס סיסמה / אימות מייל) **בלי לשלוח מייל**,
   ואנחנו שולחים אותו בעצמנו. המכסה של יצירת קישורים גבוהה בהרבה ממכסת המיילים (כניסה: 20,000 ביום מול 5).
   הרשאה: חשבון שירות של פרויקט ה־Firebase עם התפקיד "Firebase Authentication Admin". בייצור חשבון השירות של השרתון מפרויקט
   אחר — אז אסימון גישה בשם snb-session@<פרויקט> (IAM generateAccessToken, אותה הרשאת Token Creator של החתימה ב־session.js).
   התפקיד ניתן ל־snb-session פעם אחת במסוף (משימות-פתוחות.md). בלי ההרשאה — שגיאה, והטלפון חוזר לשליחה של Firebase. */
const G = require('./gauth');

const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';
const SIGNER = () => process.env.SNB_SESSION_SIGNER || ('snb-session@' + PROJECT() + '.iam.gserviceaccount.com');
const TYPES = { in: 'EMAIL_SIGNIN', reset: 'PASSWORD_RESET', verify: 'VERIFY_EMAIL' };

let tokC = { at: 0, exp: 0, v: '' };
async function adminToken(deps) {
  const now = Date.now();
  if (tokC.v && now < tokC.exp - 120e3) return tokC.v;
  const sa = (deps.sa || G.serviceAccount)();
  if (!sa) throw new Error('no_sa');
  const base = await (deps.cloudToken || G.cloudToken)(deps.fetch);
  if (!sa.project_id || sa.project_id === PROJECT()) { tokC = { at: now, exp: now + 50 * 60e3, v: base }; return base; }
  const r = await deps.fetch('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/' + encodeURIComponent(SIGNER()) + ':generateAccessToken', {
    method: 'POST', headers: { Authorization: 'Bearer ' + base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/cloud-platform'], lifetime: '3600s' }) });
  if (r.status !== 200) throw new Error('iam_http_' + r.status);
  const j = await r.json();
  if (!j || !j.accessToken) throw new Error('iam_empty');
  tokC = { at: now, exp: Date.parse(j.expireTime) || now + 50 * 60e3, v: j.accessToken };
  return j.accessToken;
}

/* הקישור מ־Firebase. kind: in / reset / verify. url = לאן חוזרים (כתובת של האפליקציה). מחזיר { link, oobCode } */
async function oobLink(deps, kind, email, url) {
  const requestType = TYPES[kind];
  if (!requestType) throw new Error('bad_kind');
  const tk = await adminToken(deps);
  const body = { requestType, email, returnOobLink: true, continueUrl: url };
  if (kind === 'in') body.canHandleCodeInApp = true;
  const r = await deps.fetch('https://identitytoolkit.googleapis.com/v1/projects/' + PROJECT() + '/accounts:sendOobCode', {
    method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (r.status !== 200) {
    const j = await r.json().catch(() => ({}));
    const m = String((j && j.error && j.error.message) || '').toUpperCase();
    if (/EMAIL_NOT_FOUND|USER_NOT_FOUND/.test(m)) throw new Error('no_user');
    throw new Error('oob_http_' + r.status);
  }
  const j = await r.json();
  const link = String((j && j.oobLink) || '');
  let oobCode = '';
  try { oobCode = new URL(link).searchParams.get('oobCode') || ''; } catch (e) {}
  if (!/^https:\/\//.test(link) || !oobCode) throw new Error('oob_empty');
  return { link, oobCode };
}

module.exports = { adminToken, oobLink, TYPES, _reset: () => { tokC = { at: 0, exp: 0, v: '' }; } };
