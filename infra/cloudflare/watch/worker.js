// הניטור של הסטודיו ב־Cloudflare Workers (22/10/2026). ה־cron של GitHub ('*/10') רץ בפועל פעם ב־3–4 שעות
// (67 הרצות מ־10/10) — לכן שרת שנפל, ההמשך האוטומטי והאצווה היומית של מאגר הלמידה חיכו שעות.
// Cron Triggers של Cloudflare רצים בזמן, בחינם (Workers Free). אותה קריאה בדיוק של studio-watch.yml, שנשאר כגיבוי
// (הבדיקה בשרתון אידמפוטנטית — כתיבות בתנאי, שתי קריאות לא שולחות שתי התראות).
// אופציונלי: STUDIO_WATCH_SECRET — אותו ערך כמו ב־Vercel (Settings → Variables and Secrets של ה־Worker, סוג Secret).
const URL_WATCH = 'https://ibkr-proxy-wine.vercel.app/api/studio';

async function watch(env) {
  const headers = {};
  if (env && env.STUDIO_WATCH_SECRET) headers.authorization = 'Bearer ' + env.STUDIO_WATCH_SECRET;
  const r = await fetch(URL_WATCH, { headers });
  const t = await r.text();
  console.log('HTTP ' + r.status + ': ' + t.slice(0, 200));
  return { status: r.status, body: t.slice(0, 500) };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(watch(env).catch((e) => console.log('השרתון לא ענה: ' + (e && e.message))));
  },
  // פתיחת כתובת ה־Worker בדפדפן = בדיקה ידנית (רק מצב — השרתון לא מחזיר שום נתון אישי)
  async fetch(req, env) {
    const r = await watch(env).catch((e) => ({ status: 0, body: String(e && e.message) }));
    return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json; charset=utf-8' } });
  },
};
