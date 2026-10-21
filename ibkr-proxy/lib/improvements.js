/* יומן השיפורים שנולדו ממאגר הלמידה ומהאיסוף המלא (21/10/2026, בקשת המשתמש: "כמה השתפר מנקודה לנקודה רק בזכות המאגר,
   ומאיפה בדיוק מגיע השיפור"). כל שיפור = שורה אחת, ו־lib/learnimpact.js מודד לפיה לפני/אחרי.
   **at = הרגע שבו השיפור חי בייצור** (ISO, שעון UTC). null = עוד לא נפרס — מוצג "ממתין לפריסה" ולא נמדד.
   **אחרי כל פריסה לייצור — לעדכן כאן את at** (tests/learn-impact.test.js בודק את הצורה). m = המדדים שהשיפור אמור להזיז
   (מפתחות מ־IMP_METRICS), src = מאיפה הגיעה התובנה (devlog / lab / user / ops), he/en = שם ושורת השערה */
'use strict';

const IMPROVEMENTS = [
  { id: 'i01', at: '2026-10-21T13:09:00Z', m: ['jd'], src: 'devlog',
    he: ['ציון השופט נשמר', 'הציון אבד בכל עבודה בשרת (save_usage דרס את jg/jd) — עכשיו יש ציון לכל עבודה'],
    en: ['Judge score is kept', 'The score was lost on every server job (save_usage overwrote jg/jd)'] },
  { id: 'i02', at: '2026-10-21T13:09:00Z', m: ['sv', 'act'], src: 'devlog',
    he: ['learn_media בלי קידוד מחדש', 'מעתיקים את 240p מאיכויות הצפייה — כ־6 דק׳ פחות בסוף כל עבודה ארוכה'],
    en: ['learn_media without re-encoding', 'Copy the 240p rendition — about 6 minutes less at the end of long jobs'] },
  { id: 'i03', at: '2026-10-21T13:09:00Z', m: ['act', 'rv'], src: 'devlog',
    he: ['זיהוי השוטים ברקע', 'רץ בזמן הביקורת ולא לפניה — כ־8 דק׳ פחות על הנתיב הקריטי בסרטון ארוך'],
    en: ['Shot detection in the background', 'Runs during the review — about 8 minutes off the critical path'] },
  { id: 'i04', at: '2026-10-21T13:09:00Z', m: ['crash', 'ok'], src: 'devlog',
    he: ['"המשך" אחרי נפילה במצב חיסכון', 'ניסיון שבא אחרי נפילה באמצע היישור — בלי arena; פחות נפילות חוזרות'],
    en: ['Resume after a crash in low-memory mode', 'A retry after a crash mid-alignment runs without the arena'] },
  { id: 'i05', at: '2026-10-21T13:09:00Z', m: ['crash'], src: 'devlog',
    he: ['ההורדה לא מעמיסה זיכרון', 'מטמון הקבצים משתחרר כל 64MB בזמן היישור'],
    en: ['Downloads do not fill memory', 'File cache released every 64MB during alignment'] },
  { id: 'i06', at: '2026-10-21T13:09:00Z', m: ['up', 'tot'], src: 'user',
    he: ['הסרטון עולה במקביל לחילוץ הקול', '"הקול לקח 17 דק׳" — עכשיו הסרטון מתחיל לעלות מיד, וכשהוא מסיים ראשון מתחילים ממנו'],
    en: ['Video uploads in parallel with audio extraction', '"The audio took 17 minutes" — the video starts at once'] },
  { id: 'i07', at: '2026-10-21T13:09:00Z', m: ['jd', 'q', 'rv'], src: 'devlog',
    he: ['ביקורת בקטעים קטנים ובמקביל', 'Haiku High חשב 63K מתוך 64K טוקנים וחצי סרטון יצא בלי ביקורת — קטעים של עד 250 כתוביות, 4 במקביל, וקטע שנקטע מתפצל'],
    en: ['Review in small parallel slices', 'Haiku High spent 63K of 64K tokens thinking; half a video went unreviewed — slices of up to 250 cues, 4 in parallel'] },
  { id: 'i08', at: '2026-10-21T13:09:00Z', m: ['q', 'jd', 'ht'], src: 'devlog',
    he: ['תיקוני ההגהה מוחלים', 'בשתי עבודות 0 תיקונים — 25 ו־59 נזרקו (רווחים, מירכאות, שם שחוזר). עכשיו מוחלים בבטחה, ומה שנזרק נספר לפי סיבה'],
    en: ['Proofreading fixes are applied', 'Two jobs applied 0 fixes (25 and 59 dropped) — now applied safely, drops counted by reason'] },
  { id: 'i09', at: null, m: ['tot'], src: 'devlog',
    he: ['הכתוביות לפני הצריבה', 'הצריבה = 23 דק׳ בסוף עבודה של 87 דק׳ — הכתוביות והנגן זמינים מיד אחרי הבדיקה'],
    en: ['Subtitles before the burn', 'Burning takes 23 minutes on an 87-minute video — subtitles and the player are available right after the review'] },
];

module.exports = { IMPROVEMENTS };
