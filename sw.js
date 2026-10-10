/* Service Worker — תיק ההשקעות PWA
 * גרסה: bump את CACHE_NAME בכל שינוי בקבצי האפליקציה כדי שהתקנות קיימות יתעדכנו.
 */
const CACHE_NAME = 'portfolio-pwa-v385';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './returns.js',
  './cloud.js',
  './firebase-config.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './logo-header.png',
  './apple-touch-icon.png',
  './favicon-48.png',
  './ibkr-logo.png'
];

/* האקדמיה (שלב 8): קבצי הספרייה והקורא — נטענים מראש בכל עדכון רק אצל מי שכבר נכנס לספרייה
   (library.js במטמון הקודם), כדי שקריאה אופליין תעבוד גם אחרי עדכון גרסה. כשל כאן לא מפיל את ההתקנה. */
const LIB_SHELL = [
  './library.js', './library.css', './academy-data.js', './libbackup.js', './ribbon3d.js', './pagecurl.js', './pagetex.js', './fonts/NotoSansHebrew-VF.woff2',
  './vendor/foliate-js/view.js', './vendor/foliate-js/epub.js', './vendor/foliate-js/epubcfi.js',
  './vendor/foliate-js/paginator.js', './vendor/foliate-js/overlayer.js', './vendor/foliate-js/progress.js',
  './vendor/foliate-js/search.js', './vendor/foliate-js/text-walker.js', './vendor/foliate-js/footnotes.js',
  './vendor/foliate-js/mobi.js', './vendor/foliate-js/fb2.js', './vendor/foliate-js/comic-book.js',
  './vendor/foliate-js/fixed-layout.js', './vendor/foliate-js/vendor/zip.js', './vendor/foliate-js/vendor/fflate.js'
];

/* v354: סטודיו התרגום — אותו דבר: נטען מראש בעדכון רק אצל מי שכבר נכנס אליו (studio.js במטמון הקודם).
   v355: גם studionet.js ו־libbackup.js (המודולים שהסטודיו מייבא) — בלעדיהם הסטודיו לא נפתח אופליין.
   Mediabunny (vendor/mediabunny) לא כאן: חילוץ הקול צריך רשת בכל מקרה (ההעלאה), והוא נשמר במטמון בשימוש הראשון */
const STUDIO_SHELL = ['./studio.js', './studio.css', './studionet.js', './libbackup.js', './studioplay.js', './studiosubs.js', './studioedl.js', './studioai.js'];   // מ1: הנגן · מ2: עורך הכתוביות · מ4: עורך הווידאו · מ7: גיליון ה־AI

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL)
        .then(() => caches.match('./library.js'))
        .then((used) => used && cache.addAll(LIB_SHELL).catch(() => {}))
        .then(() => caches.match('./studio.js'))
        .then((used) => used && cache.addAll(STUDIO_SHELL).catch(() => {})))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

/* v193: מטמון ריצה למשאבים חיצוניים שכמעט לא משתנים — לוגואים (FMP / TradingView) וקבצי ה־SDK של Firebase
   (כתובות עם גרסה). cache-first: פעם אחת מהרשת, אחר כך מיד מהמטמון. רק תשובות תקינות (לא opaque — הן תופסות מכסה ענקית). */
const RUNTIME = 'portfolio-pwa-rt-v1';
const RT_HOSTS = { 'upload.wikimedia.org': /^\/wikipedia\/commons\//, 'thumb.wikimedia.org': /^\/wikipedia\/commons\//, 'financialmodelingprep.com': /^\/image-stock\//, 's3-symbol-logo.tradingview.com': /./, 'www.gstatic.com': /^\/firebasejs\// };

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME && k !== RUNTIME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* מ1 (10/10/2026): נגן הסטודיו — ./studio-media/<id> = פרוקסי טווחים (Range) לקובץ ב־Drive של המשתמש. = MEDIA_PATH ב־studionet.js
   האסימון, הגודל והסוג מגיעים מהדף שמנגן (MessageChannel; הדף עונה רק לקבצים שהוא עצמו ביקש) — לא בכתובת, לא במטמון, לא בדיסק.
   SW שהופעל מחדש שוכח — ומבקש שוב לבד. Content-Range לא חשוף בתשובת CORS של Drive — נבנה מהטווח ומהגודל
   (מהספייק של הסשן המקביל: תקרה לבקשה פתוחה, 416, 401 = אסימון חדש פעם אחת, בלי מטמון). */
const MEDIA_RE = /\/studio-media\/([A-Za-z0-9_-]{10,200})$/;
const MEDIA_CAP = 4 * 1024 * 1024;               // בקשה פתוחה ("bytes=0-") — עד 4MB (8MB = עד 8MB מבוזבזים בכל דילוג)
const MEDIA_CAP_RANGE = 64 * 1024 * 1024;        // טווח מפורש (קטע של איכויות הצפייה — hls.js) — כולו; הנגן מקבץ קטעים עד 24MB
const mediaTok = new Map();                      // id → { t, exp, size, type }
function mediaRange(h, size, cap) {
  if (!h) return [0, Math.min(size, cap) - 1];
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(h).trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let a, b;
  if (m[1] === '') { a = Math.max(0, size - Number(m[2])); b = size - 1; }
  else { a = Number(m[1]); b = m[2] === '' ? a + cap - 1 : Number(m[2]); }
  b = Math.min(b, size - 1, a + (m[1] !== '' && m[2] !== '' ? Math.max(cap, MEDIA_CAP_RANGE) : cap) - 1);
  return a > b || a >= size ? null : [a, b];
}
/* R2 (ת4, הסשן המקביל): קישור חתום ישיר ל־R2 — רק https למארח של R2, בלי משתמש/סיסמה בכתובת */
function r2Url(u) {
  if (typeof u !== 'string' || u.length > 4096) return false;
  try { const x = new URL(u); return x.protocol === 'https:' && /\.r2\.cloudflarestorage\.com$/.test(x.hostname) && !x.username && !x.password; } catch (e) { return false; }
}
function askToken(clientId, id, fresh) {
  return self.clients.get(clientId).then((c) => new Promise((ok) => {
    if (!c) { ok(null); return; }
    const ch = new MessageChannel();
    const tm = setTimeout(() => ok(null), 10000);
    ch.port1.onmessage = (e) => {
      clearTimeout(tm);
      const d = e.data || {};
      const size = Math.floor(Number(d.size) || 0);
      const type = /^(video|audio)\/[\w.+-]{1,40}$/.test(String(d.type || '')) ? d.type : 'video/mp4', exp = Number(d.exp) || Date.now() + 30 * 60e3;
      if (size > 0 && r2Url(d.u)) { ok({ u: d.u, exp, size, type }); return; }   // R2: קישור חתום (בלי Authorization)
      ok(typeof d.t === 'string' && /^[\x21-\x7e]{10,4096}$/.test(d.t) && size > 0 ? { t: d.t, exp, size, type } : null);
    };
    c.postMessage({ snbMedia: id, fresh: !!fresh }, [ch.port2]);
  }));
}
async function mediaFetch(event, id) {
  for (let i = 0; i < 2; i++) {
    let e = mediaTok.get(id);
    if (!e || i === 1 || e.exp - 60e3 <= Date.now()) {
      e = await askToken(event.clientId, id, i === 1);
      if (!e) return new Response('', { status: 403 });
      mediaTok.set(id, e);
    }
    const r = mediaRange(event.request.headers.get('range'), e.size, MEDIA_CAP);
    if (!r) return new Response('', { status: 416, headers: { 'Content-Range': 'bytes */' + e.size } });
    const rg = 'bytes=' + r[0] + '-' + r[1];
    const res = e.u ? await fetch(e.u, { headers: { Range: rg }, cache: 'no-store', credentials: 'omit' })   // R2: הקישור החתום, בלי Authorization
      : await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media', { headers: { Authorization: 'Bearer ' + e.t, Range: rg }, cache: 'no-store' });
    if ((res.status === 401 || res.status === 403) && i === 0) { mediaTok.delete(id); continue; }   // האסימון פג — פעם אחת חדש
    if (res.status !== 206 && !(res.status === 200 && r[0] === 0)) return new Response('', { status: 502 });
    const end = res.status === 200 ? e.size - 1 : r[1];
    return new Response(res.body, { status: 206, headers: {
      'Content-Type': e.type, 'Content-Length': String(end - r[0] + 1), 'Content-Range': 'bytes ' + r[0] + '-' + end + '/' + e.size,
      'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' } });
  }
  return new Response('', { status: 401 });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const mm = url.origin === self.location.origin && MEDIA_RE.exec(url.pathname);
  if (mm) { event.respondWith(mediaFetch(event, mm[1])); return; }

  // בקשות API (Stooq וכדומה) — תמיד רשת בלבד, לעולם לא מהמטמון.
  // אם אין רשת, האפליקציה עצמה נופלת לנתונים שמורים ב-localStorage.
  if (url.origin !== self.location.origin) {
    const re = RT_HOSTS[url.hostname];
    if (!re || !re.test(url.pathname)) return;
    event.respondWith(
      caches.open(RUNTIME).then((cache) => cache.match(request).then((hit) => hit || fetch(request).then((res) => {
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      })))
    );
    return;
  }

  // App shell: קודם מטמון, אחרת רשת — כדי שהאפליקציה תיפתח גם אופליין.
  event.respondWith(
    caches.match(request, { ignoreSearch: false }).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return res;
      }).catch(() => {
        // ניווט שנכשל אופליין — נחזור לדף הבית השמור
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        throw new Error('offline');
      });
    })
  );
});

// שלב 4 בסטודיו (10/10/2026): התראות לטלפון. התוכן מוצפן מקצה לקצה (RFC 8291) ומכיל רק כותרת, שורה,
// סוג האירוע ומזהה העבודה — בלי שם קובץ. נגיעה = פתיחת האפליקציה על העבודה (‎#studio=<id>, openStockFromHash).
self.addEventListener('push', (event) => {
  let m = {};
  try { m = event.data ? event.data.json() : {}; } catch (e) { m = {}; }
  const title = String(m.t || 'THE SNOWBALL').slice(0, 80);
  const url = /^https:\/\/yishaiguedj1\.github\.io\/portfolio-pwa\/(#studio=j[A-Za-z0-9_-]{20})?$/.test(String(m.u || '')) ? m.u : './';
  event.waitUntil(self.registration.showNotification(title, {
    body: String(m.b || '').slice(0, 160), icon: 'icon-192.png', badge: 'favicon-48.png', lang: 'he', dir: 'auto',
    tag: m.j ? 'studio-' + m.j : 'studio', renotify: m.k === 'ask' || m.k === 'gate', data: { url },
    // מ9: עבודה שהסתיימה — ישר לנגן או לעורך (האפליקציה בודקת שאפשר; אחרת נשארת בדף העבודה)
    actions: m.k === 'done' && url !== './' ? [{ action: 'play', title: 'צפייה' }, { action: 'subs', title: 'עריכה' }] : [],
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let u = (event.notification.data && event.notification.data.url) || './';
  if ((event.action === 'play' || event.action === 'subs') && u.includes('#studio=')) u += '&v=' + event.action;
  const url = new URL(u, self.registration.scope).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope) && 'focus' in w) { try { await w.navigate(url); } catch (e) {} return w.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
