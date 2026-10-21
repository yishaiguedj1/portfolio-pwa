/* יומן השיפורים שנולדו ממאגר הלמידה ומהאיסוף המלא (21/10/2026, בקשת המשתמש: "כמה השתפר מנקודה לנקודה רק בזכות המאגר,
   ומאיפה בדיוק מגיע השיפור"). כל שיפור = שורה אחת, ו־lib/learnimpact.js מודד לפיה לפני/אחרי.
   **at = הרגע שבו השיפור חי בייצור** (ISO, שעון UTC). null = עוד לא נפרס — מוצג "ממתין לפריסה" ולא נמדד.
   **אחרי כל פריסה לייצור — לעדכן כאן את at** (tests/learn-impact.test.js בודק את הצורה). m = המדדים שהשיפור אמור להזיז
   (מפתחות מ־IMP_METRICS), src = מאיפה הגיעה התובנה (devlog / lab / user / ops), he/en = שם ושורת השערה */
'use strict';

const IMPROVEMENTS = [
  { id: 'i01', at: null, m: ['jd'], src: 'devlog',
    he: ['ציון השופט נשמר', 'הציון אבד בכל עבודה בשרת (save_usage דרס את jg/jd) — עכשיו יש ציון לכל עבודה'],
    en: ['Judge score is kept', 'The score was lost on every server job (save_usage overwrote jg/jd)'] },
  { id: 'i02', at: null, m: ['sv', 'act'], src: 'devlog',
    he: ['learn_media בלי קידוד מחדש', 'מעתיקים את 240p מאיכויות הצפייה — כ־6 דק׳ פחות בסוף כל עבודה ארוכה'],
    en: ['learn_media without re-encoding', 'Copy the 240p rendition — about 6 minutes less at the end of long jobs'] },
  { id: 'i03', at: null, m: ['act', 'rv'], src: 'devlog',
    he: ['זיהוי השוטים ברקע', 'רץ בזמן הביקורת ולא לפניה — כ־8 דק׳ פחות על הנתיב הקריטי בסרטון ארוך'],
    en: ['Shot detection in the background', 'Runs during the review — about 8 minutes off the critical path'] },
  { id: 'i04', at: null, m: ['crash', 'ok'], src: 'devlog',
    he: ['"המשך" אחרי נפילה במצב חיסכון', 'ניסיון שבא אחרי נפילה באמצע היישור — בלי arena; פחות נפילות חוזרות'],
    en: ['Resume after a crash in low-memory mode', 'A retry after a crash mid-alignment runs without the arena'] },
  { id: 'i05', at: null, m: ['crash'], src: 'devlog',
    he: ['ההורדה לא מעמיסה זיכרון', 'מטמון הקבצים משתחרר כל 64MB בזמן היישור'],
    en: ['Downloads do not fill memory', 'File cache released every 64MB during alignment'] },
  { id: 'i06', at: null, m: ['up', 'tot'], src: 'user',
    he: ['הסרטון עולה במקביל לחילוץ הקול', '"הקול לקח 17 דק׳" — עכשיו הסרטון מתחיל לעלות מיד, וכשהוא מסיים ראשון מתחילים ממנו'],
    en: ['Video uploads in parallel with audio extraction', '"The audio took 17 minutes" — the video starts at once'] },
];

module.exports = { IMPROVEMENTS };
