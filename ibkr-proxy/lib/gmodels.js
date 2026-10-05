/* v333: סדר המודלים של Gemini לפי המכסה החינמית (נבדק 10/2026: ל־Flash כ־20 בקשות ביום, ל־Flash-Lite כ־500;
   לכל מודל מכסה נפרדת). עד v332 התרגום פנה קודם ל־Flash ונעצר ב־429 הראשון — "המכסה נגמרה" כמעט בכל שימוש.
   עכשיו: 429/503/404/תשובה פגומה = ממשיכים למודל הבא; "מכסה" רק כשכל המודלים החזירו 429.
   GEMINI_MODEL (ב־Vercel) — תמיד ראשון. */
const uniq = (a) => a.filter((m, i) => m && a.indexOf(m) === i);
// תרגום: קצר ותדיר — המהיר והזול קודם
// v339 (מדידה חיה 05/10/2026): 3.5 Flash-Lite — ~350 קלט / ~65 פלט / 0 חשיבה, ~2 שנ׳, איכות מצוינת; 3.1 Flash-Lite — דומה,
// איטי יותר, מכסה נפרדת. Flash הוצא מהתרגום: יקר פי 3 וחשיבה שאי אפשר לכבות — בלי תועלת למשימה קצרה. 2.5 Flash-Lite לא זמין יותר
const TRANSLATE_MODELS = () => uniq([process.env.GEMINI_MODEL, 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest']);
// ניתוח מכתב (v334, החלטת המשתמש): Flash-Lite ראשון — מכסה גדולה והקשר של מיליון טוקנים; Flash גיבוי, ואחריו Mistral (lib/insight.js)
const INSIGHT_MODELS = () => uniq([process.env.GEMINI_INSIGHT_MODEL, 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash']);
// תשובה בעברית שמכילה אותיות ערביות ("חפير" — נמצא בתשובה חיה) — פסולה, עוברים למודל הבא
const badScript = (s, lang) => lang === 'he' && /[؀-ۿ]/.test(String(s || ''));
// v335: תיקון אחרון לאות ערבית שגלשה לעברית ("חפير" → "חפיר") — רק כשכל המודלים נכשלו כך, עדיף על תרגום בסיסי בלי הקשר
const AR_HE = { 'ا': 'א', 'أ': 'א', 'إ': 'א', 'آ': 'א', 'ب': 'ב', 'ت': 'ת', 'ث': 'ת', 'ج': 'ג', 'ح': 'ח', 'خ': 'ח', 'د': 'ד', 'ذ': 'ד', 'ر': 'ר', 'ز': 'ז', 'س': 'ס', 'ش': 'ש', 'ص': 'צ', 'ض': 'צ', 'ط': 'ט', 'ظ': 'ט', 'ع': 'ע', 'غ': 'ג', 'ف': 'פ', 'ق': 'ק', 'ك': 'כ', 'ل': 'ל', 'م': 'מ', 'ن': 'נ', 'ه': 'ה', 'ة': 'ה', 'و': 'ו', 'ي': 'י', 'ى': 'י', 'ء': '' };
const fixScript = (s) => String(s || '').replace(/[\u0600-\u06FF]/g, (c) => (c in AR_HE ? AR_HE[c] : c));
module.exports = { TRANSLATE_MODELS, INSIGHT_MODELS, badScript, fixScript };
