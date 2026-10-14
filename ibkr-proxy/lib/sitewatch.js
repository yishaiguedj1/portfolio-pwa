/* שלב 5 (14/10/2026, ב2 — החלטה 6 בתוכנית העמידות): ניטור הכתובות מבחוץ.
   הבדיקה המתוזמנת (studio-watch.yml → GET /api/studio ב־Vercel) בודקת גם את הכתובות עצמן: השרתון שלנו (ייצור וניסוי)
   ושלוש האפליקציות. כתובת שנכשלה בשתי בדיקות רצופות = "נפלה" → התראה לטלפון של המנהל (פעם אחת), וכשהיא חוזרת — "חזרה".
   הבדיקה רצה ב־Vercel — מחוץ לשרת שלנו, כך שגם נפילה מלאה שלו מתגלה. טהור — בלי רשת (הבדיקה עצמה ב־api/studio.js) */
const SITES = [
  ['api', 'https://api.thesnowball.app/healthz'],
  ['api-staging', 'https://api-staging.thesnowball.app/healthz'],
  ['invest', 'https://invest.thesnowball.app/sw.js'],
  ['academy', 'https://academy.thesnowball.app/sw.js'],
  ['studio', 'https://studio.thesnowball.app/sw.js'],
];
const NAMES = SITES.map((s) => s[0]);
const TIMEOUT = 8000;

const set = (s) => String(s || '').split(',').filter((x) => NAMES.includes(x));
const join = (a) => NAMES.filter((x) => a.includes(x)).join(',');

/* prev = { sd: 'api,…' (נפלו — כבר נשלחה התראה), sp: '…' (נכשלו פעם אחת) }; ok = { api: true, … } (שם חסר = לא נבדק).
   מחזיר את המצב הבא + מי נפלה עכשיו ומי חזרה */
function siteStep(prev, ok) {
  const was = set(prev && prev.sd), pend = set(prev && prev.sp);
  const failed = NAMES.filter((n) => ok[n] === false);
  const down = failed.filter((n) => !was.includes(n) && pend.includes(n));
  const up = was.filter((n) => ok[n] === true);
  const sd = join(was.filter((n) => !up.includes(n)).concat(down));
  const sp = join(failed.filter((n) => !sd.split(',').includes(n)));
  return { sd, sp, down, up };
}

module.exports = { SITES, NAMES, TIMEOUT, siteStep };
