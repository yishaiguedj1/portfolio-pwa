/* v333: סדר המודלים של Gemini לפי המכסה החינמית (נבדק 10/2026: ל־Flash כ־20 בקשות ביום, ל־Flash-Lite כ־500;
   לכל מודל מכסה נפרדת). עד v332 התרגום פנה קודם ל־Flash ונעצר ב־429 הראשון — "המכסה נגמרה" כמעט בכל שימוש.
   עכשיו: 429/503/404/תשובה פגומה = ממשיכים למודל הבא; "מכסה" רק כשכל המודלים החזירו 429.
   GEMINI_MODEL (ב־Vercel) — תמיד ראשון. */
const uniq = (a) => a.filter((m, i) => m && a.indexOf(m) === i);
// תרגום: קצר ותדיר — המהיר והזול קודם
const TRANSLATE_MODELS = () => uniq([process.env.GEMINI_MODEL, 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash']);
// ניתוח מכתב (v334, החלטת המשתמש): Flash-Lite ראשון — מכסה גדולה והקשר של מיליון טוקנים; Flash גיבוי, ואחריו Mistral (lib/insight.js)
const INSIGHT_MODELS = () => uniq([process.env.GEMINI_INSIGHT_MODEL, 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash']);
// תשובה בעברית שמכילה אותיות ערביות ("חפير" — נמצא בתשובה חיה) — פסולה, עוברים למודל הבא
const badScript = (s, lang) => lang === 'he' && /[؀-ۿ]/.test(String(s || ''));
module.exports = { TRANSLATE_MODELS, INSIGHT_MODELS, badScript };
