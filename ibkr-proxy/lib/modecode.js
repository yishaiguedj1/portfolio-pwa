'use strict';
/* 16/11/2026 (בקשת המשתמש): בכל הסטודיו המשתמשים יודעים שהתרגום ב־Claude — אבל לא באיזה מודל. מוצג רק "רגיל" / "ביצועים",
   וגם מי שסורק את האתר או את התעבורה (מתחרים) לא יגלה את המודל.
   איך: המזהים הפנימיים של המצבים (המשפחה והמאמץ) נשארים בשרתון, בעובד ובמאגר הלמידה — שם צריך לדעת הכל, וגם נשמר יותר
   (spec.mdl, המודל המדויק). בגבול מול הטלפון ומרכז הניהול (api/studio.js, wrapRes): כל מזהה פנימי → קוד אטום, ובקשה נכנסת
   → בחזרה למזהה הפנימי (modeIn). הטלפון ומרכז הניהול מכירים רק קודים (studio.js MODES, admin-app.js) — בלי שום שם של מודל
   בקבצים שהאתר מגיש (tests/model-hide.test.js). למנהל בלבד — השמות האמיתיים, מהשרתון אחרי התחברות (mn ב־status),
   וגם מזהי המודל בשורות העלות. לכל השאר: מזהה מודל (claude-…) → 'claude', וטקסט מערכת (msg, דוח אחרי תקלה) בלי שמות.
   קוד חדש למצב חדש = כאן (MODE_CODE) + MODES בטלפון; "ביצועים" עובר למודל אחר = מחליפים כאן לאיזה מזהה פנימי 'perf' מצביע,
   והמזהה הקודם מקבל קוד lab. הטלפון לא משתנה. */

const MODE_CODE = {
  'haiku-medium': 'std',     // "רגיל" — ברירת המחדל (= DEFAULT_MODE ב־lib/studio.js)
  'haiku-high': 'perf',      // "ביצועים"
  'sonnet-low': 'lab1',      // מכאן — רק למנהל ולרשימת "כל המודלים" (בדיקות)
  'sonnet-medium': 'lab2',
  'sonnet-high': 'lab3',
  'opus-medium': 'lab4',
};
const LEGACY = { 'opus-high': 'opus-medium', 'opus-max': 'opus-medium' };   // = LEGACY_MODES ב־lib/studio.js
const CODE_MODE = Object.fromEntries(Object.entries(MODE_CODE).map(([m, c]) => [c, m]));
const CODES = Object.values(MODE_CODE);
const PUBLIC_CODES = ['std', 'perf'];   // = PUBLIC_MODES ב־lib/studio.js וב־studio.js

/* מזהה פנימי (או ישן) → קוד; '' כשזה לא מזהה מצב */
const codeOf = (m) => (typeof m === 'string' ? MODE_CODE[m] || MODE_CODE[LEGACY[m]] || '' : '');
/* קוד → מזהה פנימי; כל ערך אחר כמו שהוא (מזהה פנימי מגרסה ישנה של הטלפון ממשיך לעבוד) */
const modeIn = (x) => (typeof x === 'string' && CODE_MODE[x] ? CODE_MODE[x] : x);

/* השמות — רק למנהל (status.mn, אחרי התחברות). לא בשום קובץ שהאתר מגיש */
const FAM = { haiku: 'Haiku', sonnet: 'Sonnet', opus: 'Opus' };
const EFF = { low: 'Low', medium: 'Medium', high: 'High', max: 'Max' };
const VER = '5.5';   // = MODELS ב־translator/llm.py (claude-<משפחה>-5-5)
function modeNames() {
  const out = {};
  for (const [m, c] of Object.entries(MODE_CODE)) { const [f, e] = m.split('-'); out[c] = FAM[f] + ' ' + VER + ' · ' + EFF[e]; }
  return out;
}

/* הטיוטה לייחוס (מרכז הניהול, viRef): הטלפון שולח קוד מצב; השרתון מכיר את האות (o/s/h = VP_MODES) */
function draftIn(x, vpModes) {
  if (typeof x !== 'string' || !CODE_MODE[x]) return x;
  const m = CODE_MODE[x];
  return Object.keys(vpModes || {}).find((k) => vpModes[k] === m) || x;
}

/* בקשה מהטלפון / ממרכז הניהול: השדות שנושאים מצב — קוד → מזהה פנימי (במקום) */
function inModes(body, vpModes) {
  if (!body || typeof body !== 'object') return body;
  if (typeof body.mode === 'string') body.mode = modeIn(body.mode);
  if (body.spec && typeof body.spec === 'object' && typeof body.spec.mode === 'string') body.spec.mode = modeIn(body.spec.mode);
  if (Array.isArray(body.modes)) body.modes = body.modes.map(modeIn);
  if (Array.isArray(body.arms)) for (const a of body.arms) if (a && typeof a === 'object' && typeof a.mode === 'string') a.mode = modeIn(a.mode);
  if (body.rl && typeof body.rl === 'object' && typeof body.rl.mx === 'string') body.rl.mx = modeIn(body.rl.mx);
  if (body.draft != null) body.draft = draftIn(body.draft, vpModes);
  return body;
}

/* ---- תשובה החוצה ---- */
const MID = /^claude-[a-z0-9][a-z0-9.-]{0,60}$/i;                                   // מזהה מודל שלם (שורות העלות, הדוח, הסוכנים)
const MID_IN = /\bclaude-(?:opus|sonnet|haiku|fable|instant)\b[a-z0-9.-]*/gi;         // מזהה מודל בתוך טקסט — אף פעם לא תוכן של משתמש
const MODE_IN_TXT = /\b(?:opus|sonnet|haiku)-(?:low|medium|high|max)\b/gi;
const EFF_TAIL = '(?:\\s*\\d+(?:\\.\\d+)?)?(?:\\s*[·-]?\\s*(?:Low|Medium|High|Max)\\b)?';
const FAM_TXT = new RegExp('\\b(?:Claude\\s+)?(?:Sonnet|Haiku|Fable)\\b' + EFF_TAIL, 'gi');
// "Opus" לבד = גם פורמט הקול — מסננים רק עם גרסה / מאמץ / "Claude" לפניו
const OPUS_TXT = new RegExp('\\bClaude\\s+Opus\\b' + EFF_TAIL + '|\\bOpus(?=\\s*\\d|\\s*[·-]?\\s*(?:Low|Medium|High|Max)\\b)' + EFF_TAIL, 'gi');
/* טקסט מערכת (העובד והשרתון כותבים אותו, לא המשתמש) — שם מודל → Claude */
function scrubText(s) {
  return String(s).replace(MID_IN, 'Claude').replace(MODE_IN_TXT, (m) => codeOf(m.toLowerCase()) || 'Claude')
    .replace(FAM_TXT, 'Claude').replace(OPUS_TXT, 'Claude').replace(/\bClaude(?:\s+Claude)+\b/g, 'Claude');
}
/* מפתחות של טקסט מערכת: הודעת ההתקדמות / הסיום / התקלה של העובד, והדוח אחרי תקלה (ps.t → 'pst') */
const TEXT_KEYS = new Set(['msg', 'err', 'pst', 'why', 'reason']);

function outStr(s, admin, key) {
  const c = codeOf(s);
  if (c) return c;
  if (admin) return s;
  if (MID.test(s)) return 'claude';
  if (TEXT_KEYS.has(key)) return scrubText(s);
  return s.indexOf('laude-') >= 0 ? s.replace(MID_IN, 'Claude') : s;
}
/* עותק עמוק של התשובה: מזהים פנימיים (ערכים ומפתחות) → קודים; למי שאינו מנהל — גם מזהי מודל וטקסט מערכת.
   רק אובייקטים פשוטים ומערכים (Buffer / Date — כמו שהם) */
function pubOut(v, admin, key, depth) {
  const d = depth || 0;
  if (typeof v === 'string') return outStr(v, admin, key);
  if (d > 40 || v == null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => pubOut(x, admin, key, d + 1));
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return v;
  const o = {};
  for (const k of Object.keys(v)) o[codeOf(k) || k] = pubOut(v[k], admin, k === 't' && key === 'ps' ? 'pst' : k, d + 1);
  return o;
}

/* res עטוף: כל json(...) עובר דרך pubOut. admin() נקרא בזמן השליחה (המשתמש מזוהה רק אחרי האימות).
   למנהל — לכל תשובה מצורפים השמות (mn): מרכז הניהול והסטודיו מציגים אותם בכל מסך, בלי בקשה נוספת ובלי שם בקוד */
function wrapRes(res, admin) {
  const isAdm = typeof admin === 'function' ? admin : () => !!admin;
  const w = new Proxy(res, {
    get(t, p) {
      if (p === 'json') return (o) => {
        const a = isAdm(), x = pubOut(o, a);
        return t.json(a && x && typeof x === 'object' && !Array.isArray(x) && x.mn === undefined ? Object.assign(x, { mn: modeNames() }) : x);
      };
      if (p === 'status') return (c) => { t.status(c); return w; };
      const v = t[p];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  return w;
}

module.exports = { MODE_CODE, CODE_MODE, CODES, PUBLIC_CODES, LEGACY, codeOf, modeIn, modeNames, draftIn, inModes, scrubText, pubOut, wrapRes, TEXT_KEYS };
