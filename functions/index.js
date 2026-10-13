/* שלב 4 בתוכנית שלוש האפליקציות (13/10/2026): כתובת לכל אפליקציה על אותו פרויקט Cloudflare Pages.
   הפונקציה רצה רק על השורש ('/') — Pages יוצר לה _routes.json עם הנתיב הזה בלבד, ושאר הקבצים מוגשים
   כרגיל, בלי להיספר במכסת Workers. בשורש של academy[-staging].thesnowball.app מוגש academy.html (וב־studio —
   studio.html) באותה כתובת נקייה; בכל כתובת אחרת (Invest, האתר המאוחד, תצוגות מקדימות) — index.html כרגיל.
   אותה רשימה ב־firebase-config.js (APP_HOST_RE) וב־sw.js (ROOT_PAGE). */
const ROOT_RE = /^(academy|studio)(-staging)?\.thesnowball\.app$/;

export function rootPage(host) {
  const m = ROOT_RE.exec(String(host || '').toLowerCase());
  return m ? '/' + m[1] : '';   // ‎/academy = academy.html (Pages מגיש בלי הסיומת)
}

export function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const page = (request.method === 'GET' || request.method === 'HEAD') && rootPage(url.hostname);
  if (!page) return next();
  url.pathname = page;   // ה־query (למשל ?v= של sw.js) והקישור העמוק (#) נשמרים
  return env.ASSETS.fetch(new Request(url.toString(), request));
}
