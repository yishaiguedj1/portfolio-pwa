/* Service Worker — תיק ההשקעות PWA
 * גרסה: bump את CACHE_NAME בכל שינוי בקבצי האפליקציה כדי שהתקנות קיימות יתעדכנו.
 */
const CACHE_NAME = 'portfolio-pwa-v380';

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
const STUDIO_SHELL = ['./studio.js', './studio.css', './studionet.js', './libbackup.js', './studioplay.js', './studiosubs.js'];   // מ1: הנגן · מ2: עורך הכתוביות

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
const mediaTok = new Map();                      // id → { t, exp, size, type }
function mediaRange(h, size, cap) {
  if (!h) return [0, Math.min(size, cap) - 1];
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(h).trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let a, b;
  if (m[1] === '') { a = Math.max(0, size - Number(m[2])); b = size - 1; }
  else { a = Number(m[1]); b = m[2] === '' ? a + cap - 1 : Number(m[2]); }
  b = Math.min(b, size - 1, a + cap - 1);
  return a > b || a >= size ? null : [a, b];
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
      ok(typeof d.t === 'string' && /^[\x21-\x7e]{10,4096}$/.test(d.t) && size > 0
        ? { t: d.t, exp: Number(d.exp) || Date.now() + 30 * 60e3, size, type: /^(video|audio)\/[\w.+-]{1,40}$/.test(String(d.type || '')) ? d.type : 'video/mp4' } : null);
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
    const res = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media',
      { headers: { Authorization: 'Bearer ' + e.t, Range: 'bytes=' + r[0] + '-' + r[1] }, cache: 'no-store' });
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
