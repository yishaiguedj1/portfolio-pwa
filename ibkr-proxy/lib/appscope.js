/* שלב 7 בתוכנית שלוש האפליקציות (15/10/2026): כל פעולה בשרתון שייכת לאפליקציה — ומקבלת בקשות רק ממנה.
   עד היום כל אפליקציה יכלה לקרוא לכל פעולה (למשל קוד שרץ ב־Academy — ספרים של צד שלישי — למשוך את דוחות IBKR מהכספת).
   שתי בדיקות, ב־guard של כל פעולה (lib/ibkr.js):
   1. המקור (Origin) — הכתובת של האפליקציה (appForOrigin, אותה רשימה סגורה של החיבור המשותף);
   2. טענת app בטוקן של Firebase (הטוקן המותאם של החיבור המשותף) — גם מי שמחזיק טוקן גנוב לא עובר לאפליקציה אחרת.
   הבדיקה כאן רק חוסמת: הטוקן נפתח בלי אימות חתימה, והפעולה עצמה מאמתת אותו כרגיל — טוקן מזויף נכשל שם.
   בלי אפליקציה (github.io, localhost, התחברות ישירה עם Google) ו־'all' — כמו קודם. פעולה שלא ברשימה (מחירים,
   היסטוריה, חיפוש, לוגואים — מידע ציבורי) — פתוחה לכולן. פעולה חדשה שנוגעת בנתונים של משתמש = שורה כאן + בדיקה. */
const { appForOrigin, sessEnv } = require('./session');

const SCOPE = {
  'flex-request': ['invest'],
  'flex-statement': ['invest'],
  'ibkr-sync': ['invest'],
  library: ['academy'],
  translate: ['academy'],
  bookmeta: ['academy'],
  studio: ['studio'],
};
/* חריגים לפי op: הגיבוי של Invest ל־Drive (pfbackup.js) עובר דרך פעולות gd* של /api/library;
   op:'cfg' של /api/studio = מצב התחזוקה והדגלים הציבוריים — כל שלוש האפליקציות טוענות אותו (core.js) */
function scopeFor(name, op) {
  if (name === 'library' && /^gd[A-Z]/.test(String(op || ''))) return ['academy', 'invest'];
  if (name === 'studio' && op === 'cfg') return null;
  return SCOPE[name] || null;
}
function endpointOf(url) {
  const m = /^\/api\/([a-z-]+)/.exec(String(url || '').split('?')[0]);
  return m ? m[1] : '';
}
/* app מתוך טוקן של Firebase — בלי אימות (רק לחסימה; האימות בפעולה עצמה) */
function tokenApp(tok) {
  const p = String(tok || '').split('.');
  if (p.length !== 3 || p[1].length > 6000) return '';
  try {
    const c = JSON.parse(Buffer.from(p[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return typeof c.app === 'string' ? c.app : '';
  } catch (e) { return ''; }
}
/* '' = מותר, אחרת קוד השגיאה */
function appDenied(req, body, env) {
  const name = endpointOf(req && req.url);
  const allow = scopeFor(name, body && body.op);
  if (!allow) return '';
  const h = (req && req.headers) || {};
  const oa = appForOrigin(h.origin || h.Origin || '', sessEnv(env));
  if (oa && oa !== 'all' && !allow.includes(oa)) return 'wrong_app';
  const ta = tokenApp(body && body.idToken);
  if (ta && ta !== 'all' && !allow.includes(ta)) return 'wrong_app';
  return '';
}

module.exports = { appDenied, scopeFor, endpointOf, tokenApp, SCOPE };
