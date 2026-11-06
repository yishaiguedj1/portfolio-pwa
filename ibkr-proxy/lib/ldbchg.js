'use strict';
/* 5/11/2026 — שלב 3 בתוכנית העצמאות מ־Firebase (תוכנית-עצמאות-מ-Firebase.md): יומן השינויים של Vercel.
   הרקע: בשרת שלנו האוספים שרק השרתון ניגש אליהם עברו למסד משלנו (lib/ldb.js), ו־Firestore הוא עותק שמתעדכן במנות
   (lib/ldbsync.js). Vercel, הגיבוי החם, ממשיך לקרוא ולכתוב ישירות ב־Firestore. כדי שהשרת שלנו יידע מה Vercel שינה, בלי
   לקרוא אוספים שלמים, כל כתיבה מוצלחת של Vercel לאוסף כזה רושמת מסמך קטן ב־`snbChg/<אוסף>~<מזהה>`:
     c, i — האוסף והמזהה · t — מתי (ms) · d — נמחק · m — השדות שנכתבו (איחוד, appendMissingElements) · f=1 — נכתב כולו.
   מסמך אחד לכל מסמך שהשתנה (כתיבה חוזרת דורסת), כך שהיומן חסום. השרת שלנו קורא את מה שנוסף, מאחד ומוחק את מה שטופל.
   עלות: כתיבה נוספת לכל כתיבה של Vercel, רק כש־Vercel עובד (כשהשרת שלנו נפל, או במעבר לגיבוי ב־5xx).
   נטען גם מ־tools/server-provision.js (רישום שרת חדש כותב ישר ל־studioServers). */

/* האוספים שהטלפון ניגש אליהם ישירות (firestore/firestore.rules — tests/ldb.test.js משווה).
   שלב 4 (6/11/2026, lib/udata.js): עם SNB_UDATA=on הם נכנסים למסד במצב "דרך" (thru) — קריאה מהמסד, וכתיבה ממשיכה מיד
   ל־Firestore עם אותה מסכה (ומשם חוזרת למסד). כך Firestore תמיד שלם: גם הטלפון כותב בו ישירות כשהשרת לא זמין */
const CLIENT = new Set(['users', 'academyUsers']);
const CHG = 'snbChg';
const COL_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
/* דולק: SNB_UDATA=on, או הדגל ud_srv במרכז הניהול (דולק כברירת מחדל מ־6/11/2026, כיבוי ב־flOff) (sysCfg/main.flOn — lib/sysflags.js; נקרא מהמסד, lib/ldbsync.js thruProbe) */
let probe = () => false;
const setThruProbe = (f) => { probe = typeof f === 'function' ? f : () => false; };
const thruOn = (env = process.env) => env.SNB_UDATA === 'on' || !!probe();
/* אוסף של הטלפון שעבר למסד (רק כש־SNB_UDATA=on) */
const thru = (c) => CLIENT.has(c) && thruOn();
/* אוסף שעבר (או יעבור) למסד שלנו: לא של הטלפון (אלא במצב "דרך"), ולא יומן השינויים עצמו */
const serverCol = (c) => COL_RE.test(String(c || '')) && (!CLIENT.has(c) || thruOn()) && c !== CHG;
/* מה שנרשם ביומן מכתיבה של Vercel: גם האוספים של הטלפון (תמיד — כך השרת יודע עליהם כשהמצב "דרך" נדלק) */
const stampCol = (c) => COL_RE.test(String(c || '')) && c !== CHG;

const FS_RE = /^https:\/\/firestore\.googleapis\.com\/v1\/projects\/([^/]+)\/databases\/(?:\(default\)|%28default%29)\/documents(.*)$/;
/* פירוק כתובת של Firestore: { project, path:[מקטעים], verb ('' | 'runQuery' | 'commit' …), qs: URLSearchParams } או null */
function parseUrl(url) {
  const m = FS_RE.exec(String(url || ''));
  if (!m) return null;
  let rest = m[2], qs = '';
  const qi = rest.indexOf('?');
  if (qi >= 0) { qs = rest.slice(qi + 1); rest = rest.slice(0, qi); }
  let verb = '';
  const ci = rest.lastIndexOf(':');
  if (ci >= 0 && rest.indexOf('/', ci) < 0) { verb = rest.slice(ci + 1); rest = rest.slice(0, ci); }
  let path;
  try { path = rest.split('/').filter(Boolean).map(decodeURIComponent); } catch (e) { return null; }
  return { project: decodeURIComponent(m[1]), path, verb, qs: new URLSearchParams(qs) };
}
/* projects/P/databases/(default)/documents/col/id → { project, col, id } (רק מסמך ברמה העליונה) */
function parseName(name) {
  const m = /^projects\/([^/]+)\/databases\/\(default\)\/documents\/([^/]+)\/([^/]+)$/.exec(String(name || ''));
  return m ? { project: m[1], col: m[2], id: m[3] } : null;
}
const docName = (project, col, id) => 'projects/' + project + '/databases/(default)/documents/' + col + '/' + id;
/* מזהה ביומן: האוסף והמזהה (מזהה של Firestore לא מכיל '/') */
const chgId = (col, id) => col + '~' + id;
/* שדה עליון של נתיב (a.b → a, `x-y`.z → x-y) — היומן שומר את השדות העליונים, וזה מה שהאיחוד מעתיק */
function topField(fp) {
  const s = String(fp || '');
  if (s[0] === '`') { const e = s.indexOf('`', 1); return e > 0 ? s.slice(1, e) : s.slice(1); }
  const d = s.indexOf('.');
  return d >= 0 ? s.slice(0, d) : s;
}

/* גוף ה־commit של רשומה ביומן. ch = { col, id, d, m:[שדות], full } */
function chgWrite(project, ch, now = Date.now()) {
  const tr = [];
  const m = [...new Set((ch.m || []).map(topField).filter(Boolean))].slice(0, 200);
  if (m.length) tr.push({ fieldPath: 'm', appendMissingElements: { values: m.map((x) => ({ stringValue: x })) } });
  if (ch.full) tr.push({ fieldPath: 'f', maximum: { integerValue: '1' } });
  return { update: { name: docName(project, CHG, chgId(ch.col, ch.id)), fields: {
    c: { stringValue: ch.col }, i: { stringValue: ch.id }, t: { integerValue: String(now) }, d: { booleanValue: !!ch.d } } },
    updateMask: { fieldPaths: ['c', 'i', 't', 'd'] }, updateTransforms: tr };
}
/* הכתיבות שצריך לרשום ביומן מבקשה מוצלחת ל־Firestore: [{ col, id, d, m, full }] */
function changesOf(method, url, body) {
  const u = parseUrl(url);
  if (!u) return { project: '', list: [] };
  const out = [];
  if (!u.verb && u.path.length === 2 && stampCol(u.path[0])) {
    if (method === 'DELETE') out.push({ col: u.path[0], id: u.path[1], d: true });
    else if (method === 'PATCH') {
      const m = u.qs.getAll('updateMask.fieldPaths');
      out.push({ col: u.path[0], id: u.path[1], m, full: !m.length });
    }
  } else if (u.verb === 'commit' && method === 'POST' && body && Array.isArray(body.writes)) {
    for (const w of body.writes) {
      const nm = parseName(w.delete || (w.update && w.update.name) || (w.transform && w.transform.document));
      if (!nm || !stampCol(nm.col)) continue;
      if (w.delete) { out.push({ col: nm.col, id: nm.id, d: true }); continue; }
      const m = [];
      if (w.update) {
        const mk = w.updateMask && Array.isArray(w.updateMask.fieldPaths) ? w.updateMask.fieldPaths : null;
        if (!mk) { out.push({ col: nm.col, id: nm.id, full: true }); continue; }
        m.push(...mk);
      }
      for (const t of (w.updateTransforms || (w.transform && w.transform.fieldTransforms) || [])) m.push(t.fieldPath);
      out.push({ col: nm.col, id: nm.id, m });
    }
  }
  return { project: u.project, list: out };
}
const jsonBody = (init) => {
  const b = init && init.body;
  if (typeof b !== 'string' || !b) return null;
  try { return JSON.parse(b); } catch (e) { return null; }
};
/* Vercel: עוטף את fetch — אחרי כתיבה מוצלחת לאוסף של השרתון, רשומה ביומן (באותו טוקן). תקלה ביומן לא מפילה את הכתיבה */
function stampFetch(inner, clock = Date.now) {
  if (typeof inner !== 'function' || inner._chg) return inner;
  const w = async (input, init) => {
    const r = await inner(input, init);
    try {
      const url = String(typeof input === 'string' ? input : (input && input.url) || '');
      const method = String((init && init.method) || 'GET').toUpperCase();
      if (r && r.status === 200 && method !== 'GET' && url.startsWith('https://firestore.googleapis.com/')) {
        const { project, list } = changesOf(method, url, method === 'POST' ? jsonBody(init) : null);
        if (list.length) {
          const h = (init && init.headers) || {};
          const auth = typeof h.get === 'function' ? h.get('authorization') : (h.Authorization || h.authorization);
          const now = clock();
          await inner('https://firestore.googleapis.com/v1/projects/' + project + '/databases/(default)/documents:commit', {
            method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({ writes: list.slice(0, 400).map((ch) => chgWrite(project, ch, now)) }) }).catch(() => null);
        }
      }
    } catch (e) {}
    return r;
  };
  w._chg = true;
  return w;
}
/* מותקן ב־Vercel בלבד (lib/gauth.js נטען בכל פונקציה שניגשת ל־Firestore). כיבוי: SNB_LDB_CHG=off */
function installOnVercel(env = process.env) {
  if (!env.VERCEL || env.SNB_LDB_CHG === 'off' || typeof globalThis.fetch !== 'function') return false;
  globalThis.fetch = stampFetch(globalThis.fetch);
  return true;
}

module.exports = { CLIENT, CHG, serverCol, stampCol, thru, thruOn, setThruProbe, parseUrl, parseName, docName, chgId, topField, chgWrite, changesOf, stampFetch, installOnVercel };
