/* Service Worker — תיק ההשקעות PWA
 * הגרסה והטביעות נכתבים ב־node tools/swgen.js (מ־APP_VERSION שב־app.js ומהקבצים עצמם) — לא לערוך ביד.
 * התקנה = כל קובץ במעטפת יורד עם ‎?v=<טביעה> ונבדק מול הטביעה; קובץ ישן (CDN באמצע פריסה) = ההתקנה נכשלת,
 * הגרסה הקודמת נשארת, והדפדפן מנסה שוב בבדיקת העדכון הבאה. לכן תוכן ו־sw.js עולים יחד, ב־PR אחד.
 */
/* <swgen> נוצר ב־node tools/swgen.js — לא לערוך ביד. הבדיקות ושומר הפריסה משווים לקבצים */
const CACHE_NAME = 'portfolio-pwa-v439';
const HASHES = {
  "./": "4ea641b80e22297bbebba35123ed046b",
  "./index.html": "4ea641b80e22297bbebba35123ed046b",
  "./styles.css": "fbb6061acd78b2f40130ebea04e3dd9d",
  "./app.js": "863e0beddc9ed224328d3f34f8b4879c",
  "./returns.js": "2f3dc3487aece0da5b647ef7c5673c46",
  "./cloud.js": "39bf52f7bb220ecf474e77b2572386d3",
  "./firebase-config.js": "ffaf70bf205506ec1d4230d9ed4ad036",
  "./move.js": "5f2580e686bc4768e65086b897398db6",
  "./manifest.webmanifest": "933cd57a01bc2c47f5e1904be166220b",
  "./icon-192.png": "cf3bed681a924e2fbecc04893a92f5bf",
  "./icon-512.png": "7eff4578ee1f38ddb524eace83d90024",
  "./logo-header.png": "0a8a4bf5de266a98afdae4d3c4db66b7",
  "./apple-touch-icon.png": "113a5dd87df18077a64196f3d533e3e9",
  "./favicon-48.png": "b06144704421831d745fd553558517a7",
  "./ibkr-logo.png": "3c73fe172d48b3f58f11bcc146dd1987",
  "./library.js": "13b115847c283b3fcf1f83b0b68e20fb",
  "./library.css": "b3c30e9b53d028cf7b60423e7d31f6ea",
  "./academy-data.js": "5a761be316a12e64ddb5427c02b642df",
  "./libbackup.js": "b8ae4b2558a1ad7d7bea075d2c3e86a5",
  "./ribbon3d.js": "ec23dd0dea0fe5f8ab6ed78a2a596452",
  "./pagecurl.js": "223e78015f232482221512af5d67e2a7",
  "./pagetex.js": "8d4c24fd38625957c16882d7e778148b",
  "./libadmin.js": "37ae2eb318b4fd187205d2327c57350f",
  "./epubkit.js": "6221dcdea67d6ae4b617bab6cd1bb79b",
  "./fonts/NotoSansHebrew-VF.woff2": "cc3f6ef471cb7aff587f63873a650e32",
  "./vendor/foliate-js/view.js": "e0093af921feb03bb58fb51aeedc321f",
  "./vendor/foliate-js/epub.js": "dfe347495039e9b5991478986ec6b771",
  "./vendor/foliate-js/epubcfi.js": "e1a688ad5c84bf31f33cef467f92c7a6",
  "./vendor/foliate-js/paginator.js": "51cec81572d5d182e231fe68ce9c3b54",
  "./vendor/foliate-js/overlayer.js": "d3d3396e3083277ccbd4f17c40762115",
  "./vendor/foliate-js/progress.js": "544f5e90babc0cb31c5caf971a5f06dd",
  "./vendor/foliate-js/search.js": "31e846bdc095a645de0e94f7baa2c9e1",
  "./vendor/foliate-js/text-walker.js": "4ad740ab6142b5be428700ef4d270253",
  "./vendor/foliate-js/footnotes.js": "d377b45d2ac05290c42873612ec0a92e",
  "./vendor/foliate-js/mobi.js": "016526df13a9f11ee6671a8c74346e1c",
  "./vendor/foliate-js/fb2.js": "09a7890bf191f1b6c6dd435fae2868b8",
  "./vendor/foliate-js/comic-book.js": "7f3bf77561ca77300d5244015fcb1f73",
  "./vendor/foliate-js/fixed-layout.js": "7aee1d15d8e0479b8a6c59a20304b250",
  "./vendor/foliate-js/vendor/zip.js": "2a0d43157e4a447c6e43351225758795",
  "./vendor/foliate-js/vendor/fflate.js": "e63bcc21f83a43e5f71d5cbefd351ff4",
  "./academy.html": "e7f536140456bdf6163ff1f094fcfec2",
  "./academy-app.js": "799da4a976132c0b32bae2ff8ea00845",
  "./strings-academy.js": "eda57de50002fbde0e5bab610fa98023",
  "./core.js": "17b9c241b5b7ba65e08a91479a1731ce",
  "./auth.js": "556d7250a03993819af63e6ade4382b1",
  "./shell.js": "9ca89f5948c5dbbbc2be2d71054ed35e",
  "./logo-academy.webp": "1861cb325f7ac8b9a82f90ef41e2b940",
  "./logo-academy-lg.webp": "a116879278b6fa9d301f98fc24137cab",
  "./icon-academy-192.png": "b82b5761fdea121b4c7517b5846c4933",
  "./apple-touch-academy.png": "75c0b94a544390ed9ae20cc3f86f0ead",
  "./favicon-academy-48.png": "f6cbfb6ef0edd6cb50bfd3ab8cb69ce2",
  "./studio.js": "0b6b04d63ff9419b3505f83c2d6f3348",
  "./studio.css": "3b2f35029d2459ab5f062d1a0a6496ff",
  "./studionet.js": "7b287b60864e1e383c2ab955a2502d2f",
  "./studioplay.js": "8cce97bbb6d36a16c2813766f8b308d4",
  "./studiosubs.js": "059a0f0cc98817f5ed0a45ec4a362bb0",
  "./studioedl.js": "6374ccc5beb6a6addf0b8e1ac10ac56f",
  "./studioai.js": "e0a43e7a48c70e3bf5028813acebbf3e",
  "./studiostore.js": "633c4083aebf82cdc389813e65ecee16",
  "./studio.html": "e797e443dfa76398884be3d9f012d250",
  "./studio-app.js": "5a63fccdc0e5a519e999c9c3be1b71d0",
  "./strings-studio.js": "0aeb8bdbad33414fd063f5098807b6b0",
  "./logo-studio.webp": "0d7c2fa06f0d037782ba1371411e641a",
  "./logo-studio-lg.webp": "607346abe8a670fb1a60499d52575398",
  "./icon-studio-192.png": "9b37d795c2aceac291c56b3ce425aaa3",
  "./apple-touch-studio.png": "2845bce92943f4c0a3a3d1309063f850",
  "./favicon-studio-48.png": "3ee4d1aaaf6e22684603032cf358c704"
};
/* </swgen> */

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './returns.js',
  './cloud.js',
  './firebase-config.js',
  './move.js',
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
  './library.js', './library.css', './academy-data.js', './libbackup.js', './ribbon3d.js', './pagecurl.js', './pagetex.js', './libadmin.js', './epubkit.js', './fonts/NotoSansHebrew-VF.woff2',
  './vendor/foliate-js/view.js', './vendor/foliate-js/epub.js', './vendor/foliate-js/epubcfi.js',
  './vendor/foliate-js/paginator.js', './vendor/foliate-js/overlayer.js', './vendor/foliate-js/progress.js',
  './vendor/foliate-js/search.js', './vendor/foliate-js/text-walker.js', './vendor/foliate-js/footnotes.js',
  './vendor/foliate-js/mobi.js', './vendor/foliate-js/fb2.js', './vendor/foliate-js/comic-book.js',
  './vendor/foliate-js/fixed-layout.js', './vendor/foliate-js/vendor/zip.js', './vendor/foliate-js/vendor/fflate.js',
  './academy.html', './academy-app.js', './strings-academy.js', './core.js', './auth.js',   // שלב 3ג: Academy כדף עצמאי
  './shell.js', './logo-academy.webp', './logo-academy-lg.webp', './icon-academy-192.png', './apple-touch-academy.png', './favicon-academy-48.png'   // ההדר המשותף + הלוגו של Academy
];

/* v354: סטודיו התרגום — אותו דבר: נטען מראש בעדכון רק אצל מי שכבר נכנס אליו (studio.js במטמון הקודם).
   v355: גם studionet.js ו־libbackup.js (המודולים שהסטודיו מייבא) — בלעדיהם הסטודיו לא נפתח אופליין.
   Mediabunny (vendor/mediabunny) לא כאן: חילוץ הקול צריך רשת בכל מקרה (ההעלאה), והוא נשמר במטמון בשימוש הראשון */
const STUDIO_SHELL = ['./studio.js', './studio.css', './studionet.js', './libbackup.js', './studioplay.js', './studiosubs.js', './studioedl.js', './studioai.js', './studiostore.js',
  './studio.html', './studio-app.js', './strings-studio.js', './core.js', './auth.js', './shell.js', './logo-studio.webp', './logo-studio-lg.webp', './icon-studio-192.png', './apple-touch-studio.png', './favicon-studio-48.png'];   // שלב 3ד: Studio כדף עצמאי   // מ1: הנגן · מ2: עורך הכתוביות · מ4: עורך הווידאו · מ7: גיליון ה־AI · ת4: studiostore.js (מזהי R2)

/* 12/10/2026 (פס פריסה אחד): קובץ מהרשת רק אם הוא בדיוק הקובץ שהגרסה הזו נבנתה ממנו.
   ‎?v=<טביעה> = כתובת חדשה ל־CDN (לא עותק ישן מהמטמון שלו), cache:'reload' = לא מהמטמון של הדפדפן.
   עד היום ההתקנה לקחה מה שהגיע (addAll) והמשיכה גם בכישלון — קובץ ישן נכנס למטמון החדש לתמיד ("הרעלה"). */
/* שלב 4 (13/10/2026): כתובת לכל אפליקציה — בשורש של academy[-staging].thesnowball.app מוגש academy.html
   (functions/index.js ב־Cloudflare Pages), ובשל studio — studio.html. לכן './' במטמון = הדף של הכתובת הזו,
   והטביעה שלו נבדקת מול הדף הזה (אחרת ההתקנה נכשלת: '/' שם הוא לא index.html). */
const ROOT_PAGE = (() => {
  const m = /^(academy|studio)(-staging)?\.thesnowball\.app$/.exec((self.location && self.location.hostname) || '');
  return m ? './' + m[1] + '.html' : './index.html';
})();
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
async function fetchVerified(p) {
  const want = HASHES[p === './' ? ROOT_PAGE : p];
  const res = await fetch(new Request(want ? p + '?v=' + want.slice(0, 12) : p, { cache: 'reload' }));
  if (!res.ok) throw new Error('http ' + res.status + ' ' + p);
  const buf = await res.arrayBuffer();
  if (want && hex(await crypto.subtle.digest('SHA-256', buf)).slice(0, want.length) !== want) throw new Error('stale ' + p);
  return new Response(buf, { headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream' } });
}

/* 13/10/2026 (תקלה בניסוי — "עדיין לא התעדכן"): בכתובת של Academy / Studio, ‏‎/index.html מופנה (308) לשורש, ושם מוגש
   דף האפליקציה — הקובץ לעולם לא תואם לטביעה של index.html, וכל התקנה (הכל או כלום) נכשלה: הטלפון נשאר על הגרסה הישנה
   עד מחיקת נתוני האתר. שם index.html (הדף של Invest) לא נחוץ — מדלגים עליו. */
const SHELL = ROOT_PAGE === './index.html' ? APP_SHELL : APP_SHELL.filter((p) => p !== './index.html');

/* הכתובת → מפתח ברשימת הטביעות ('./studio.css'), רק לקובץ בלי פרמטרים שאינו ניווט; אחרת null */
function shellKey(url, request) {
  if (request.mode === 'navigate' || url.search) return null;
  const base = new URL((self.registration && self.registration.scope) || './', self.location.href).pathname;
  if (!url.pathname.startsWith(base)) return null;
  const k = './' + url.pathname.slice(base.length);
  return k !== './' && k !== './index.html' && HASHES[k] ? k : null;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    // המעטפת — הכל או כלום: קובץ אחד ישן/חסר = ההתקנה נכשלת והגרסה הקודמת ממשיכה לעבוד
    const got = await Promise.all(SHELL.map(async (p) => [p, await fetchVerified(p)]));
    const cache = await caches.open(CACHE_NAME);
    for (const [p, r] of got) await cache.put(p, r);
    // הספרייה והסטודיו — רק אצל מי שכבר נכנס אליהם; קובץ שלא אומת לא נשמר (יורד מהרשת בשימוש)
    for (const [set, mark] of [[LIB_SHELL, './library.js'], [STUDIO_SHELL, './studio.js']]) {
      // 13/10/2026: בכתובת של האפליקציה עצמה (academy / studio) — תמיד, גם אחרי ניקוי מטמון (עד היום רק אצל מי שכבר נכנס)
      if (!(await caches.match(mark)) && ROOT_PAGE !== (set === LIB_SHELL ? './academy.html' : './studio.html')) continue;
      await Promise.all(set.map((p) => fetchVerified(p).then((r) => cache.put(p, r), () => {})));
    }
    await self.skipWaiting();
  })());
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
      // 13/10/2026 (אריח המגדל האדום): קובץ מהרשימה של הגרסה שלא במטמון — רק מאומת, כמו בהתקנה. fetch רגיל קיבל
      // מהמטמון של הדפדפן (Cloudflare: עד 4 שעות בלי בדיקה) עותק של גרסה קודמת, והוא נשמר כאן עד הגרסה הבאה.
      const key = shellKey(url, request);
      if (key) return fetchVerified(key).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(key, copy));
        return res;
      }, () => fetch(new Request(request, { cache: 'reload' })));   // לא אומת (פריסה באמצע?) — מהרשת, בלי לשמור
      return fetch(request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return res;
      }).catch(() => {
        // ניווט שנכשל אופליין — הדף עצמו מהמטמון (גם עם ?query; שלב 3: academy.html/studio.html), אחרת דף הבית השמור.
        // Cloudflare Pages מעביר academy.html → ‎/academy ("כתובת יפה"), והמטמון שמור תחת academy.html — מנסים גם עם הסיומת
        if (request.mode === 'navigate') {
          const bare = /\/[^/.]+$/.test(url.pathname) ? url.pathname + '.html' : '';
          return caches.match(request, { ignoreSearch: true })
            .then((pg) => pg || (bare ? caches.match(bare, { ignoreSearch: true }) : null))
            .then((pg) => pg || caches.match('./'));
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
  // הקישור תמיד בכתובת שבה נרשמה ההתראה (שלב 4: גם ב־studio[-staging].thesnowball.app) — מההודעה רק מזהה העבודה
  const hm = /^https:\/\/[^#\s]*(#studio=j[A-Za-z0-9_-]{20})$/.exec(String(m.u || ''));
  const url = './' + (hm ? hm[1] : '');
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
