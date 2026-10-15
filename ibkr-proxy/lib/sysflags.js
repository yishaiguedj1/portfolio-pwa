'use strict';
/* מצב תחזוקה והגדרות ודגלים (15/10/2026, בקשת המשתמש — מהמחקר על ServiceNow: System Maintenance ו־System Properties).
   טהור, בלי קריאות. מסמך אחד: sysCfg/main — שדות שטוחים בלבד (JSON_FIELDS ב־studio.js הולכים לפי שם שדה בכל האוספים,
   ושמות קצרים כמו f/m כבר תפוסים — לכן שמות ארוכים וייחודיים):
     mtOn (0/1) · mtMsg (הודעה למשתמשים) · mtTil (עד מתי, 0 = עד שמכבים) · mtAt (מתי הודלק)
     flOff — רשימה מופרדת בפסיקים של הדגלים שכבויים (כל דגל שלא ברשימה — דולק; דגל חדש דולק כברירת מחדל)
   מה שמוצג במסך הדגלים חייב להיות נאכף בקוד — לכל דגל המקום שבו הוא נבדק (where). דגל חדש = כאן + האכיפה + מחרוזות. */

const FLAGS = [
  { k: 'st_api', app: 'studio', where: 'api/studio.js — sysBlock (יצירה, התחלה, המשך)' },          // תרגום בשרת שלנו
  { k: 'st_routine', app: 'studio', where: 'api/studio.js — sysBlock (יצירה, התחלה, המשך)' },      // תרגום ב־Claude שבמנוי (Routine)
  { k: 'st_auto', app: 'studio', where: 'api/studio.js — autoRecover' },                            // "המשך" אוטומטי אחרי תקלה חולפת
  { k: 'learn', app: 'studio', where: 'api/studio.js — learnSave, learnPut' },                      // איסוף למאגר הלמידה
  { k: 'push', app: 'all', where: 'api/studio.js — notify' },                                       // התראות לטלפון
  { k: 'iv_live', app: 'invest', where: 'app.js — liveCanTick' },                                   // מחירים חיים ב־Invest
];
const KEYS = FLAGS.map((f) => f.k);
const MSG_MAX = 140;
const TIL_MAX = 7 * 864e5;   // תחזוקה מתוזמנת — עד שבוע קדימה

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

/* מה שהאפליקציות מקבלות (בלי התחברות): רק התחזוקה וההדלקה של כל דגל — בלי מי הדליק ומתי */
function publicCfg(doc, now) {
  const off = offSet(doc), f = {};
  for (const k of KEYS) f[k] = !off.has(k);
  return { m: maintOn(doc, now) ? { on: true, msg: normMsg(doc.mtMsg), til: +doc.mtTil > 0 ? +doc.mtTil : 0 } : null, f };
}
/* למנהל: הכל, כולל מתי הודלק */
function adminCfg(doc, now) {
  return Object.assign(publicCfg(doc, now), { mt: { on: +((doc && doc.mtOn) || 0) === 1, msg: normMsg(doc && doc.mtMsg), til: +((doc && doc.mtTil) || 0), at: +((doc && doc.mtAt) || 0) },
    flags: FLAGS.map((x) => ({ k: x.k, app: x.app, on: !offSet(doc).has(x.k) })) });
}
/* שינוי מהמנהל → השדות לכתיבה (או null — לא תקין). b = { mt: {on, msg, til} } או { flag: k, on } */
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
  return null;
}

module.exports = { FLAGS, KEYS, MSG_MAX, TIL_MAX, normMsg, maintOn, flagOn, publicCfg, adminCfg, applyAdmin };
