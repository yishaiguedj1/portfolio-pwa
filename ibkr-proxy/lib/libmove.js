/* שלב 6 בתוכנית שלוש האפליקציות (15/10/2026): הנתונים של Academy עוברים ממסמך התיק למסמך משלהם.
   עד היום ההתקדמות, ההדגשות, האסופות והגדרות הקורא נשמרו בשדה lib בתוך users/{uid} — אותו מסמך של התיק.
   מעכשיו: academyUsers/{uid}.lib, וכללי Firestore לפי טענת app בטוקן — Academy לא ניגשת לתיק, ו־Invest לא לספרייה.

   ההעברה כאן, בשרתון (חשבון השירות עוקף את הכללים): לטלפון עם טוקן של Academy אין גישה למסמך התיק.
   1. העתקה: users/{uid}.lib → academyUsers/{uid}.lib, כמו שהוא (אותו פורמט של Firestore — בלי המרה), ו־mv = מתי.
      רק כשאין עוד mv. אם במסמך החדש כבר יש lib (נכתב לפני שההעברה הצליחה) — איחוד לפי ספר, החדש גובר (merged).
   2. מחיקה: שבוע אחרי ההעברה (DEL_AFTER) — השדה lib נמחק ממסמך התיק, ו־dl = מתי. עד אז הוא נשאר כגיבוי.
   הטלפון קורא ל־op:'libMove' פעם אחת בכל כניסה לספרייה כל עוד אין dl. */
const { datastoreToken } = require('./gauth');

const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';
const BASE = () => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents/';
const COL = 'academyUsers';
const DEL_AFTER = 7 * 864e5;
const UID_RE = /^[A-Za-z0-9]{6,128}$/;
const KEYS = ['p', 'a', 'c', 's'];

async function call(deps, method, path, body) {
  const tk = await (deps.token || datastoreToken)(deps.fetch);
  const r = await (deps.fetch || fetch)(BASE() + path, {
    method, headers: Object.assign({ Authorization: 'Bearer ' + tk }, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
  return r.json();
}
const num = (f, k) => +(((f || {})[k] || {}).integerValue || 0);
const mapOf = (v) => (v && v.mapValue && v.mapValue.fields) || null;

/* הצעד הבא לפי שני המסמכים (טהורה — נבדקת): 'copy' / 'del' / 'done' / 'wait' */
function plan(oldF, newF, now) {
  const mv = num(newF, 'mv'), dl = num(newF, 'dl');
  if (dl) return 'done';
  if (!mv) return 'copy';
  if (now - mv < DEL_AFTER) return 'wait';
  return oldF && oldF.lib ? 'del' : 'done';
}
/* מה נכתב במסמך החדש בהעתקה (טהורה): התקדמות/הדגשות/אסופות — איחוד לפי ספר/אסופה, מה שכבר במסמך החדש גובר
   (נכתב אחרי ההעברה = עדכני יותר); הגדרות הקורא — של המסמך החדש אם יש, אחרת של הישן */
function merged(oldLib, newLib) {
  const o = mapOf(oldLib) || {}, n = mapOf(newLib) || {};
  const out = {};
  for (const k of KEYS) {
    if (k === 's') { if (n.s || o.s) out.s = n.s || o.s; continue; }
    const of = mapOf(o[k]), nf = mapOf(n[k]);
    if (!of && !nf) continue;
    out[k] = { mapValue: { fields: Object.assign({}, of || {}, nf || {}) } };
  }
  return { mapValue: { fields: out } };
}

async function move(deps, uid, now) {
  if (!UID_RE.test(String(uid || ''))) throw new Error('bad_uid');
  const nd = await call(deps, 'GET', COL + '/' + uid);
  const newF = (nd && nd.fields) || {};
  if (num(newF, 'dl')) return { st: 'done' };
  const od = await call(deps, 'GET', 'users/' + uid + '?mask.fieldPaths=lib');
  const oldF = (od && od.fields) || {};
  const step = plan(oldF, newF, now);
  if (step === 'copy') {
    const fields = { mv: { integerValue: String(now) } };
    if (oldF.lib || newF.lib) fields.lib = merged(oldF.lib, newF.lib);
    await call(deps, 'PATCH', COL + '/' + uid + '?updateMask.fieldPaths=mv' + (fields.lib ? '&updateMask.fieldPaths=lib' : ''), { fields });
    return { st: 'copied', had: !!oldF.lib };
  }
  if (step === 'del') {
    await call(deps, 'PATCH', 'users/' + uid + '?updateMask.fieldPaths=lib', { fields: {} });   // שדה ב־updateMask שלא בגוף = נמחק
    await call(deps, 'PATCH', COL + '/' + uid + '?updateMask.fieldPaths=dl', { fields: { dl: { integerValue: String(now) } } });
    return { st: 'deleted' };
  }
  if (step === 'done' && !num(newF, 'dl')) {
    await call(deps, 'PATCH', COL + '/' + uid + '?updateMask.fieldPaths=dl', { fields: { dl: { integerValue: String(now) } } });
    return { st: 'done' };
  }
  return { st: step };
}

module.exports = { move, plan, merged, COL, DEL_AFTER };
