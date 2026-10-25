'use strict';
/* מצב תחזוקה והגדרות ודגלים (15/10/2026, בקשת המשתמש — מהמחקר על ServiceNow: System Maintenance ו־System Properties).
   טהור, בלי קריאות. מסמך אחד: sysCfg/main — שדות שטוחים בלבד (JSON_FIELDS ב־studio.js הולכים לפי שם שדה בכל האוספים,
   ושמות קצרים כמו f/m כבר תפוסים — לכן שמות ארוכים וייחודיים):
     mtOn (0/1) · mtMsg (הודעה למשתמשים) · mtTil (עד מתי, 0 = עד שמכבים) · mtAt (מתי הודלק)
     flOff — רשימה מופרדת בפסיקים של הדגלים שכבויים (כל דגל שלא ברשימה — דולק; דגל חדש דולק כברירת מחדל)
     amEm — מי מקבל את כל מצבי התרגום (15/10/2026, בקשת המשתמש): מיילים מופרדים בפסיקים, אותיות קטנות. לכולם — רק
     PUBLIC_MODES (lib/studio.js); המנהל ומי שברשימה — כל המצבים. נאכף ב־api/studio.js (modeOk). לא יוצא ב־publicCfg
     tsEm — חשבונות הבדיקה של הסטודיו (25/10/2026, בקשת המשתמש): גישה לסטודיו כמו משתמש רגיל — "רגיל"/"ביצועים", "המנוי שלי"
     והשרת; בלי המצבים הנעולים ובלי המגדל המורחב (אלה רק למנהל / amEm). = STUDIO_USERS, אבל בלי לערוך משתנים ב־Vercel
   מה שמוצג במסך הדגלים חייב להיות נאכף בקוד — לכל דגל המקום שבו הוא נבדק (where). דגל חדש = כאן + האכיפה + מחרוזות. */

const FLAGS = [
  { k: 'st_api', app: 'studio', where: 'api/studio.js — sysBlock (יצירה, התחלה, המשך)' },          // תרגום בשרת שלנו
  { k: 'st_routine', app: 'studio', where: 'api/studio.js — sysBlock (יצירה, התחלה, המשך)' },      // תרגום ב־Claude שבמנוי (Routine)
  { k: 'st_url', app: 'studio', where: 'api/studio.js — urlProbe, create' },                          // 22/10/2026: הורדה מקישור (יוטיוב ואתרים אחרים)
  { k: 'st_auto', app: 'studio', where: 'api/studio.js — autoRecover' },                            // "המשך" אוטומטי אחרי תקלה חולפת
  { k: 'learn', app: 'studio', where: 'api/studio.js — learnSave, learnPut' },                      // איסוף למאגר הלמידה
  { k: 'learn_full', app: 'all', where: 'api/studio.js — learnFull, devSrv, devErr, devPull' },     // 15/10/2026: האיסוף המלא בתקופת הפיתוח (לוגים, קריאות, מדדים, שגיאות, טקסט מלא) — לכבות כשיהיו משתמשים
  { k: 'push', app: 'all', where: 'api/studio.js — notify' },                                       // התראות לטלפון
  { k: 'iv_live', app: 'invest', where: 'app.js — liveCanTick' },                                   // מחירים חיים ב־Invest
];
const KEYS = FLAGS.map((f) => f.k);
const MSG_MAX = 140;
const TIL_MAX = 7 * 864e5;   // תחזוקה מתוזמנת — עד שבוע קדימה
const AM_MAX = 50;   // מיילים ברשימת "כל המודלים"
const EMAIL_RE = /^[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/;
const normEmail = (s) => { const e = String(s == null ? '' : s).trim().toLowerCase(); return EMAIL_RE.test(e) ? e : ''; };
const amList = (doc) => Array.from(new Set(String((doc && doc.amEm) || '').split(',').map(normEmail).filter(Boolean))).slice(0, AM_MAX);
/* מי שברשימה — רק עם מייל מאומת (כמו STUDIO_USERS) */
const amHas = (doc, user) => !!(user && user.verified && user.email && amList(doc).includes(String(user.email).toLowerCase()));

const TS_MAX = 100;   // חשבונות בדיקה
const tsList = (doc) => Array.from(new Set(String((doc && doc.tsEm) || '').split(',').map(normEmail).filter(Boolean))).slice(0, TS_MAX);
const tsHas = (doc, user) => !!(user && user.verified && user.email && tsList(doc).includes(String(user.email).toLowerCase()));

/* הודעה למשתמשים: טקסט בלבד, שורה אחת, בלי קישורים ובלי תגיות */
function normMsg(s) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\bhttps?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim().slice(0, MSG_MAX);
}
const offSet = (doc) => new Set(String((doc && doc.flOff) || '').split(',').filter((k) => KEYS.includes(k)));

/* האם התחזוקה פעילה עכשיו (פגה לבד ב־mtTil) */
function maintOn(doc, now) {
  return !!(doc && +doc.mtOn === 1 && (!(+doc.mtTil > 0) || now < +doc.mtTil));
}
const flagOn = (doc, k) => !offSet(doc).has(k);


/* 15/10/2026 (מרכז הניהול ← הודעות): הודעה שהמנהל כותב — כותרת וטקסט, לאילו אפליקציות, עד מתי. מוצגת פעם אחת בכל מכשיר
   (לפי anId — הדלקה חדשה = מזהה חדש = מוצגת שוב). שדות שטוחים: anId (זמן ההדלקה, 0 = כבויה), anT, anB, anApps, anTil */
const AN_APPS = ['invest', 'academy', 'studio'];
const AN_T_MAX = 60, AN_B_MAX = 400;
const normAn = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\bhttps?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim().slice(0, n);
const anApps = (x) => { const l = (Array.isArray(x) ? x : String(x || '').split(',')).filter((a) => AN_APPS.includes(a)); return AN_APPS.filter((a) => l.includes(a)); };
function anView(doc, now) {
  const id = +((doc && doc.anId) || 0), til = +((doc && doc.anTil) || 0);
  if (!(id > 0) || (til > 0 && now >= til)) return null;
  const apps = anApps(doc.anApps), t = normAn(doc.anT, AN_T_MAX), b = normAn(doc.anB, AN_B_MAX);
  return apps.length && (t || b) ? { id, t, b, apps, til } : null;
}

/* מה שהאפליקציות מקבלות (בלי התחברות): רק התחזוקה וההדלקה של כל דגל — בלי מי הדליק ומתי */
function publicCfg(doc, now) {
  const off = offSet(doc), f = {};
  for (const k of KEYS) f[k] = !off.has(k);
  return { m: maintOn(doc, now) ? { on: true, msg: normMsg(doc.mtMsg), til: +doc.mtTil > 0 ? +doc.mtTil : 0 } : null, f, an: anView(doc, now) };
}
/* למנהל: הכל, כולל מתי הודלק */
function adminCfg(doc, now) {
  return Object.assign(publicCfg(doc, now), { mt: { on: +((doc && doc.mtOn) || 0) === 1, msg: normMsg(doc && doc.mtMsg), til: +((doc && doc.mtTil) || 0), at: +((doc && doc.mtAt) || 0) },
    flags: FLAGS.map((x) => ({ k: x.k, app: x.app, on: !offSet(doc).has(x.k) })), am: amList(doc), ts: tsList(doc),
    anD: { t: normAn(doc && doc.anT, AN_T_MAX), b: normAn(doc && doc.anB, AN_B_MAX), apps: anApps(doc && doc.anApps), til: +((doc && doc.anTil) || 0), on: +((doc && doc.anId) || 0) > 0 } });
}
/* שינוי מהמנהל → השדות לכתיבה (או null — לא תקין). b = { mt: {on, msg, til} } או { flag: k, on } או { am: מייל, on } או { ts: מייל, on } */
function applyAdmin(doc, b, now) {
  if (b && b.mt && typeof b.mt === 'object') {
    const on = b.mt.on === true;
    const til = Math.floor(Number(b.mt.til) || 0);
    if (til && (til <= now || til > now + TIL_MAX)) return null;
    return { mtOn: on ? 1 : 0, mtMsg: normMsg(b.mt.msg), mtTil: on ? til : 0, mtAt: on ? (maintOn(doc, now) ? +doc.mtAt || now : now) : 0 };
  }
  if (b && KEYS.includes(b.flag) && typeof b.on === 'boolean') {
    const off = offSet(doc);
    if (b.on) off.delete(b.flag); else off.add(b.flag);
    return { flOff: KEYS.filter((k) => off.has(k)).join(',') };
  }
  if (b && b.an && typeof b.an === 'object') {
    if (b.an.on !== true) return { anId: 0 };
    const t = normAn(b.an.t, AN_T_MAX), body = normAn(b.an.b, AN_B_MAX), apps = anApps(b.an.apps), til = Math.floor(Number(b.an.til) || 0);
    if (!(t || body) || !apps.length || (til && (til <= now || til > now + 60 * 864e5))) return null;
    return { anId: now, anT: t, anB: body, anApps: apps.join(','), anTil: til };
  }
  if (b && typeof b.am === 'string' && typeof b.on === 'boolean') {
    const e = normEmail(b.am);
    if (!e) return null;
    const l = amList(doc).filter((x) => x !== e);
    if (b.on) { if (l.length >= AM_MAX) return null; l.push(e); }
    return { amEm: l.join(',') };
  }
  if (b && typeof b.ts === 'string' && typeof b.on === 'boolean') {   // חשבונות בדיקה
    const e = normEmail(b.ts);
    if (!e) return null;
    const l = tsList(doc).filter((x) => x !== e);
    if (b.on) { if (l.length >= TS_MAX) return null; l.push(e); }
    return { tsEm: l.join(',') };
  }
  return null;
}

module.exports = { AN_APPS, anView, normAn, FLAGS, KEYS, MSG_MAX, TIL_MAX, AM_MAX, normMsg, normEmail, maintOn, flagOn, publicCfg, adminCfg, applyAdmin, amList, amHas, TS_MAX, tsList, tsHas };
