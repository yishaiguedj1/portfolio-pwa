// הניטור של הסטודיו ב־Cloudflare Workers (22/10/2026). ה־cron של GitHub ('*/10') רץ בפועל פעם ב־3–4 שעות
// (67 הרצות מ־10/10) — לכן שרת שנפל, ההמשך האוטומטי והאצווה היומית של מאגר הלמידה חיכו שעות.
// Cron Triggers של Cloudflare רצים בזמן, בחינם (Workers Free). אותה קריאה בדיוק של studio-watch.yml, שנשאר כגיבוי
// (הבדיקה בשרתון אידמפוטנטית — כתיבות בתנאי, שתי קריאות לא שולחות שתי התראות).
// אופציונלי: STUDIO_WATCH_SECRET — אותו ערך כמו ב־Vercel (Settings → Variables and Secrets של ה־Worker, סוג Secret).
// 24/10/2026: הראשי = השרתון (api.thesnowball.app). Vercel = גיבוי: אם השרתון לא ענה (רשת / 5xx) — הבדיקה עוברת אליו.
// ה־studio-watch.yml של GitHub נשאר על Vercel בכוונה: גיבוי עצמאי מהשרתון.
// 24/10/2026: קרון יומי נוסף — סנכרון IBKR (`/api/ibkr-sync`, 12:05 UTC) מהשרתון, עם אותו גיבוי ל־Vercel.
// הסנכרון אידמפוטנטי לכל משתמש לכל יום, לכן כפילות עם הקרון של Vercel לא פונה פעמיים ל־IBKR.
// אופציונלי: CRON_SECRET — אם מוגדר ב־Vercel, אותו ערך גם כאן (Secret). השרתון דורש אותו לכל GET של הסנכרון.
const URL_PRIMARY = 'https://api.thesnowball.app/api/studio';
const URL_BACKUP = 'https://ibkr-proxy-wine.vercel.app/api/studio';
const IBKR_CRON = '5 12 * * *';
const SYNC_PRIMARY = 'https://api.thesnowball.app/api/ibkr-sync';
const SYNC_BACKUP = 'https://ibkr-proxy-wine.vercel.app/api/ibkr-sync';

async function call(url, secret) {
  const headers = {};
  if (secret) headers.authorization = 'Bearer ' + secret;
  const r = await fetch(url, { headers });
  const t = await r.text();
  return { status: r.status, body: t.slice(0, 500) };
}

// הראשי קודם; גיבוי רק על שגיאת רשת או 5xx. מחזיר את מי שענה
async function withBackup(primary, backup, secret, label) {
  let from = 'primary', res;
  try {
    res = await call(primary, secret);
    if (res.status >= 500) throw new Error('HTTP ' + res.status);
  } catch (e) {
    console.log(label + ': השרתון לא ענה (' + (e && e.message) + ') — בודקים דרך Vercel');
    from = 'backup';
    res = await call(backup, secret);
  }
  console.log(label + ' ' + from + ' HTTP ' + res.status + ': ' + res.body.slice(0, 200));
  return { from, status: res.status, body: res.body };
}

const watch = (env) => withBackup(URL_PRIMARY, URL_BACKUP, env && env.STUDIO_WATCH_SECRET, 'ניטור');
const ibkrSync = (env) => withBackup(SYNC_PRIMARY, SYNC_BACKUP, env && env.CRON_SECRET, 'סנכרון IBKR');

export default {
  async scheduled(event, env, ctx) {
    const job = event.cron === IBKR_CRON ? ibkrSync(env) : watch(env);
    ctx.waitUntil(job.catch((e) => console.log('השרתון לא ענה: ' + (e && e.message))));
  },
  // פתיחת כתובת ה־Worker בדפדפן = בדיקה ידנית (רק מצב — השרתון לא מחזיר שום נתון אישי)
  async fetch(req, env) {
    const r = await watch(env).catch((e) => ({ status: 0, body: String(e && e.message) }));
    return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json; charset=utf-8' } });
  },
};
