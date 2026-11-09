'use strict';
/* ניתוח סרטונים (9/11/2026, גל 0 — PR 0.2; docs/studio-video-analysis-plan.md). הכללים של עבודת ניתוח בשרתון — טהור,
   בלי קריאות. עבודת ניתוח = עבודת tr עם spec.vi = 1: אותו תור, אותו שרת ואותם קבצים ב־R2; העובד מנתב ל־analyze.py.
   **זהה לעובד** (translator/analyze.py — tests/studio-vi.test.js משווה): VI_V, ‏VI_LANGS, ‏VI_MAX_S, ‏VI_FAIL, ‏VI_WARN, ‏VI_OUTS (= VI_FILES).
   הנוסח של כל קוד — STRINGS בטלפון (viE_<קוד>). */

const VI_V = 'snb.video-analysis/1';
const VI_LANGS = ['he', 'en'];   // שפת המקור; הניתוח עצמו בעברית (to = ['he']). בלי "אוטומטי" — ivrit לא מזהה שפה
const VI_MAX_S = 5400;           // 90 דק׳ ב־MVP (גל 2 — יותר)
/* 19.3: כישלון עוצר את העבודה; אזהרה נכנסת ל־vi.json (quality.warn) והעבודה ממשיכה */
const VI_FAIL = ['vi_off', 'vi_lang', 'vi_long', 'vi_card', 'vi_schema', 'cap'];
const VI_WARN = ['vi_noscreen', 'vi_lowres', 'vi_ocr', 'vi_asr_low', 'vi_partial', 'vi_unver', 'vi_ledger', 'ts_coarse'];
const VI_ERR = VI_FAIL.concat(VI_WARN);
const VI_OUTS = ['vi', 'vis', 'cues', 'small', 'thumb'];   // התוצרים, בסדר ההעלאה (vtt ו־meta — לא בהרצה יבשה)

/* החלק של הניתוח ב־spec (normSpec): null = לא עבודת ניתוח. גל 0 — הרצה יבשה בלבד (dry: בלי Claude; מודדים זמן, זיכרון
   וטוקנים). מה שלא שייך לניתוח — נדחה (bad_spec): קובץ כתוביות, תרגום בטלפון, העלאה מהאפליקציה, קריוקי, Routine,
   העתק־הדבק. מקישור — כן (העובד מוריד ל־R2, כמו בתרגום) */
function viSpec(s) {
  if (!s || s.vi !== 1) return null;
  if (s.dry !== 1 || s.eng !== 'api' || s.src === 'subs' || s.ph === 1 || s.nu === 1 || s.ka === 1 || s.cp === 1 || s.ry === 1) return false;
  return { vi: 1, dry: 1 };
}
/* השפות: מקור עברית או אנגלית, יעד עברית בלבד */
const viLangOk = (sp) => !!sp && VI_LANGS.includes(sp.from) && Array.isArray(sp.to) && sp.to.length === 1 && sp.to[0] === 'he';
/* האורך מהטלפון (0 = לא ידוע — העובד בודק אחרי הקליטה ומחזיר vi_long) */
const viTooLong = (sp) => !!sp && sp.dur > VI_MAX_S;
/* הסיכום שהעובד מדווח בסוף (vsm, 10.5): n פריטים, ok מאומתים, cov כיסוי ×100, so "רק על המסך", d משך בשניות.
   מספרים שלמים בלבד — בלי טקסט מהסרטון */
function viSummary(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const n = (x, hi) => (Number.isFinite(+x) && +x >= 0 ? Math.min(hi, Math.round(+x)) : 0);
  return { n: n(o.n, 1e5), ok: n(o.ok, 1e5), cov: n(o.cov, 100), so: n(o.so, 1e5), d: n(o.d, 86400) };
}

module.exports = { VI_V, VI_LANGS, VI_MAX_S, VI_FAIL, VI_WARN, VI_ERR, VI_OUTS, viSpec, viLangOk, viTooLong, viSummary };
