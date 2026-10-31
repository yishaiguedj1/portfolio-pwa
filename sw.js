/* Service Worker — תיק ההשקעות PWA
 * הגרסה והטביעות נכתבים ב־node tools/swgen.js (מ־APP_VERSION שב־app.js ומהקבצים עצמם) — לא לערוך ביד.
 * התקנה = כל קובץ במעטפת יורד עם ‎?v=<טביעה> ונבדק מול הטביעה; קובץ ישן (CDN באמצע פריסה) = ההתקנה נכשלת,
 * הגרסה הקודמת נשארת, והדפדפן מנסה שוב בבדיקת העדכון הבאה. לכן תוכן ו־sw.js עולים יחד, ב־PR אחד.
 */
/* <swgen> נוצר ב־node tools/swgen.js — לא לערוך ביד. הבדיקות ושומר הפריסה משווים לקבצים */
const CACHE_NAME = 'portfolio-pwa-v660';
const HASHES = {
  "./": "27c0788019f4842a124eba31840b522b",
  "./index.html": "27c0788019f4842a124eba31840b522b",
  "./styles.css": "1f022779ccc73cbbdafb37c699c9b5d4",
  "./glass-btn.css": "1e73cbdd238341463e8989bf8fdeeb2e",
  "./app.js": "222436ad6b333639b62f920a9cf5c6cb",
  "./returns.js": "7c2a8e1d4c31b5ea1bfab42d040bd2dd",
  "./cloud.js": "2cf2e330bfcc2c9150ba47b8f355982d",
  "./firebase-config.js": "b4310d14adcb697783f8cda07b91411f",
  "./move.js": "421d442c53aa29fa1b1cbc3ef22fb174",
  "./manifest.webmanifest": "933cd57a01bc2c47f5e1904be166220b",
  "./icon-192.png": "cf3bed681a924e2fbecc04893a92f5bf",
  "./icon-512.png": "7eff4578ee1f38ddb524eace83d90024",
  "./logo-header.png": "0a8a4bf5de266a98afdae4d3c4db66b7",
  "./logo-invest.webp": "c44531c94c7a7fbed46ba10379551cd2",
  "./logo-invest-lg.webp": "8219383149ad646277609dd24a74939a",
  "./face-invest.webp": "b002b4590278b60a95d3ae080ffd39c6",
  "./snow-far-light.png": "59d69655a5d5b6fda866f2520f362cc0",
  "./snow-mid-light.png": "8930aa90c47777829b0fdde807f96ed3",
  "./snow-near-light.png": "ab6066dc9cdb962556f28ea88a0e547f",
  "./snow-far-dark.png": "93133fb04738459bdd55073ffce0b375",
  "./snow-mid-dark.png": "b2b9305931041225bedc002bb9a162cc",
  "./snow-near-dark.png": "e498c2616053a47118d26dbb6a538d87",
  "./apple-touch-icon.png": "113a5dd87df18077a64196f3d533e3e9",
  "./favicon-48.png": "b06144704421831d745fd553558517a7",
  "./ibkr-logo.png": "3c73fe172d48b3f58f11bcc146dd1987",
  "./acclink.js": "419b035815109478a1f8f9780720af33",
  "./analysis.js": "29664af4106cee8a9edecf0beb6735c5",
  "./analysis.css": "4c957472dbc740b4694df29ccaeed328",
  "./chart.js": "f449f30b56da8452861aff9919ce0758",
  "./chartlib.js": "5c00c490dac1b09329fa1ce657350a9b",
  "./chart.css": "0e4e6260108563c3f329d204c1398a10",
  "./vendor/klinecharts/klinecharts.min.js": "4202d8661b8302175751d8d072bf6d2f",
  "./library.js": "c240229ad5c166438db4da05bef54cf8",
  "./library.css": "4e8ba44baf16709e07d56c5f85cbe6ac",
  "./academy-data.js": "5a761be316a12e64ddb5427c02b642df",
  "./libbackup.js": "a238c4cf7877166ba8eba5cdcf6eadb8",
  "./ribbon3d.js": "0004ce220226fadce8918b975fa43282",
  "./pagecurl.js": "0c089b75615f03f8d13a2d76725a35f6",
  "./pagetex.js": "f38ae4d98d0e1a35f14cf48cc8be9373",
  "./libadmin.js": "7fa14ea952a3a1a6ae275e6bfb7b3073",
  "./epubkit.js": "626341438a721d59521d552abc6a854d",
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
  "./academy.html": "ff70b7cdf55a58896794457f6812abf4",
  "./academy-app.js": "bb4ea1a4ff773d3775b94bccbef70e1c",
  "./strings-academy.js": "b4a6507e0568d60757a45e35d6514796",
  "./core.js": "000e3c312a8176dbec903a1278cfdcca",
  "./auth.js": "8ca95187044db7031367c49932e70efe",
  "./shell.js": "6b22a08dd74c16eefd740922596fb568",
  "./logo-academy.webp": "1861cb325f7ac8b9a82f90ef41e2b940",
  "./logo-academy-lg.webp": "a116879278b6fa9d301f98fc24137cab",
  "./face-academy.webp": "9aea37be25db82a7a48a5343a8b351b2",
  "./icon-academy-192.png": "b82b5761fdea121b4c7517b5846c4933",
  "./apple-touch-academy.png": "75c0b94a544390ed9ae20cc3f86f0ead",
  "./favicon-academy-48.png": "f6cbfb6ef0edd6cb50bfd3ab8cb69ce2",
  "./studio.js": "1a96a0eba5fa469f29a57e6ee42d35ea",
  "./studio.css": "be7c17f7215682ea2709716c1a1658cf",
  "./studionet.js": "c2f745b1e6172749596d74bfc9bc8c9e",
  "./studioplay.js": "f7a2c41fb9bbcee64b213822d3082a98",
  "./studiosubs.js": "65c3e22404cc9bfa5ea0b610a33f4633",
  "./studiotracks.js": "45a59e4cedc85da6950554bd2c56289e",
  "./studioedl.js": "344c0e6f0e7ff9bd59e36eb25db1e335",
  "./studioai.js": "e0a43e7a48c70e3bf5028813acebbf3e",
  "./studiostore.js": "42e717dbfb6b004703532f60659b14bf",
  "./studiobg.js": "9013d96cee956642e0735806ea1e60c3",
  "./studio.html": "83a0db4fc3f1058a17ce5b6370873966",
  "./studio-app.js": "d2aaad29f3f46cc04426c93bdae1eb83",
  "./strings-studio.js": "69e8f21c871346c8971c0a2d410ceecf",
  "./logo-studio.webp": "0d7c2fa06f0d037782ba1371411e641a",
  "./logo-studio-lg.webp": "607346abe8a670fb1a60499d52575398",
  "./face-studio.webp": "b26a0f320bf8b5ca69526c8275a9e940",
  "./icon-studio-192.png": "9b37d795c2aceac291c56b3ce425aaa3",
  "./apple-touch-studio.png": "2845bce92943f4c0a3a3d1309063f850",
  "./favicon-studio-48.png": "3ee4d1aaaf6e22684603032cf358c704"
};
/* </swgen> */

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './glass-btn.css',   // 31/10/2026: כפתורי זכוכית בכל המערכת
  './app.js',
  './returns.js',
  './cloud.js',
  './firebase-config.js',
  './move.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './logo-header.png', './logo-invest.webp', './logo-invest-lg.webp', './face-invest.webp', './snow-far-light.png', './snow-mid-light.png', './snow-near-light.png', './snow-far-dark.png', './snow-mid-dark.png', './snow-near-dark.png',
  './apple-touch-icon.png',
  './favicon-48.png',
  './ibkr-logo.png',
  './acclink.js',   // 26/10/2026: כניסה עם מייל ושיטות הכניסה (נטען בלחיצה)
  './analysis.js', './analysis.css',   // 25/10/2026: מנתח החברות — נטען בלחיצה, אבל באותה גרסה של app.js
  './chart.js', './chartlib.js', './chart.css', './vendor/klinecharts/klinecharts.min.js'   // 27/10/2026: גרף הנרות — נטען בלחיצה
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
  './academy.html', './academy-app.js', './strings-academy.js', './core.js', './auth.js', './acclink.js',   // שלב 3ג: Academy כדף עצמאי
  './shell.js', './logo-academy.webp', './logo-academy-lg.webp', './face-academy.webp', './snow-far-light.png', './snow-mid-light.png', './snow-near-light.png', './snow-far-dark.png', './snow-mid-dark.png', './snow-near-dark.png', './icon-academy-192.png', './apple-touch-academy.png', './favicon-academy-48.png'   // ההדר המשותף + הלוגו של Academy
];

/* v354: סטודיו התרגום — אותו דבר: נטען מראש בעדכון רק אצל מי שכבר נכנס אליו (studio.js במטמון הקודם).
   v355: גם studionet.js ו־libbackup.js (המודולים שהסטודיו מייבא) — בלעדיהם הסטודיו לא נפתח אופליין.
   Mediabunny (vendor/mediabunny) לא כאן: חילוץ הקול צריך רשת בכל מקרה (ההעלאה), והוא נשמר במטמון בשימוש הראשון */
const STUDIO_SHELL = ['./studio.js', './studio.css', './studionet.js', './libbackup.js', './studioplay.js', './studiosubs.js', './studiotracks.js', './studioedl.js', './studioai.js', './studiostore.js', './studiobg.js',
  './studio.html', './studio-app.js', './strings-studio.js', './core.js', './auth.js', './acclink.js', './shell.js', './logo-studio.webp', './logo-studio-lg.webp', './face-studio.webp', './snow-far-light.png', './snow-mid-light.png', './snow-near-light.png', './snow-far-dark.png', './snow-mid-dark.png', './snow-near-dark.png', './icon-studio-192.png', './apple-touch-studio.png', './favicon-studio-48.png'];   // שלב 3ד: Studio כדף עצמאי   // מ1: הנגן · מ2: עורך הכתוביות · מ4: עורך הווידאו · מ7: גיליון ה־AI · ת4: studiostore.js (מזהי R2)

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
/* 21/10/2026 (דיווח המשתמש: admin.thesnowball.app פתח את Invest): למרכז הניהול אין Service Worker — אבל בטלפון
   נשאר שם אחד של Invest (מלפני שהכתובת הופנתה למרכז הניהול), שהגיש מהמטמון את index.html לכל כניסה לשורש.
   בכתובת הזו הוא מוחק את המטמון ואת עצמו, ומרענן את החלונות הפתוחים (הבדיקה הבאה של app.js מורידה אותו) */
const NO_SW = /^admin(-staging)?\.thesnowball\.app$/.test((self.location && self.location.hostname) || '');
async function selfDestruct() {
  await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) { try { await c.navigate(c.url); } catch (e) {} }
}
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
async function fetchVerified(p, reuse) {
  const want = HASHES[p === './' ? ROOT_PAGE : p];
  // 27/10/2026 (מחקר היעילות): בהתקנה של גרסה חדשה — קובץ שלא השתנה (אותה טביעה) נלקח מהמטמון של הגרסה הקודמת, לא מהרשת.
  // עד היום כל עדכון הוריד מחדש את כל המעטפת (כמה MB) גם כשהשתנה קובץ אחד. האימות זהה — אותה טביעה בדיוק
  if (reuse && want) {
    const old = await caches.match(p).catch(() => null);
    if (old && old.ok) {
      const ob = await old.arrayBuffer().catch(() => null);
      if (ob && hex(await crypto.subtle.digest('SHA-256', ob)).slice(0, want.length) === want)
        return new Response(ob, { headers: { 'Content-Type': old.headers.get('Content-Type') || 'application/octet-stream' } });
    }
  }
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
  if (NO_SW) { self.skipWaiting(); return; }
  event.waitUntil((async () => {
    // המעטפת — הכל או כלום: קובץ אחד ישן/חסר = ההתקנה נכשלת והגרסה הקודמת ממשיכה לעבוד
    const got = await Promise.all(SHELL.map(async (p) => [p, await fetchVerified(p, true)]));
    const cache = await caches.open(CACHE_NAME);
    for (const [p, r] of got) await cache.put(p, r);
    // הספרייה והסטודיו — רק אצל מי שכבר נכנס אליהם; קובץ שלא אומת לא נשמר (יורד מהרשת בשימוש)
    for (const [set, mark] of [[LIB_SHELL, './library.js'], [STUDIO_SHELL, './studio.js']]) {
      // 13/10/2026: בכתובת של האפליקציה עצמה (academy / studio) — תמיד, גם אחרי ניקוי מטמון (עד היום רק אצל מי שכבר נכנס)
      if (!(await caches.match(mark)) && ROOT_PAGE !== (set === LIB_SHELL ? './academy.html' : './studio.html')) continue;
      await Promise.all(set.map((p) => fetchVerified(p, true).then((r) => cache.put(p, r), () => {})));
    }
    await self.skipWaiting();
  })());
});

/* v193: מטמון ריצה למשאבים חיצוניים שכמעט לא משתנים — לוגואים (FMP / TradingView) וקבצי ה־SDK של Firebase
   (כתובות עם גרסה). cache-first: פעם אחת מהרשת, אחר כך מיד מהמטמון. רק תשובות תקינות (לא opaque — הן תופסות מכסה ענקית). */
const RUNTIME = 'portfolio-pwa-rt-v1';
const RT_HOSTS = { 'upload.wikimedia.org': /^\/wikipedia\/commons\//, 'thumb.wikimedia.org': /^\/wikipedia\/commons\//, 'financialmodelingprep.com': /^\/image-stock\//, 's3-symbol-logo.tradingview.com': /./, 'www.gstatic.com': /^\/firebasejs\// };

self.addEventListener('activate', (event) => {
  if (NO_SW) { event.waitUntil(selfDestruct()); return; }
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

/* 22/10/2026 (בקשת המשתמש: "כל ההורדות מקומית למכשיר"): סרטון ששותף ל־Studio — מההורדה בטלפון (DlActivity) או מהגלריה.
   Studio לאנדרואיד פותח את האתר עם הקובץ (Web Share Target): Chrome שולח POST ל־/share-file. שומרים את הקובץ ב־IndexedDB
   (snb-inbox — מסד קטן משלו, בלי תלות בגרסה של snb-studio) ומעבירים לדף עם ‎#got=<מפתח> (studio.js → studioGot) */
const SHARE_RE = /\/share-file$/;
async function shareFile(request) {
  let key = '';
  try {
    const fd = await request.formData();
    const f = fd.get('video'), t = String(fd.get('text') || '').slice(0, 200);
    if (f && typeof f === 'object' && f.size > 0 && /^video\//.test(f.type || 'video/')) {
      key = Array.from(self.crypto.getRandomValues(new Uint8Array(12)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
      await new Promise((ok, no) => {
        const r = indexedDB.open('snb-inbox', 1);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('f')) r.result.createObjectStore('f'); };
        r.onerror = () => no(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction('f', 'readwrite');
          tx.objectStore('f').put({ f, t, at: Date.now() }, key);
          tx.oncomplete = () => ok(); tx.onerror = () => no(tx.error);
        };
      });
    }
  } catch (e) { key = ''; }
  return Response.redirect(new URL('./' + (key ? '#got=' + key : ''), self.registration.scope).href, 303);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!NO_SW && request.method === 'POST' && SHARE_RE.test(new URL(request.url).pathname)) { event.respondWith(shareFile(request)); return; }
  if (NO_SW || request.method !== 'GET') return;

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
/* 27/10/2026 (המשתמש: "השלבים לא מתעדכנים בווילון"): Studio הפתוחה מעדכנת את התראת השלב בעצמה (shadeSync) לפי ההערכה
   שבמסך. דיווח מהשרתון שמראה פחות (שלב קודם / אחוז נמוך יותר באותו שלב) לא מחזיר אותה אחורה */
const SHADE_STG = ['up', 'tr', 'al', 'tl', 'rv', 'bn', 'sv'];   // = STAGES ב־studionet.js
const shadeOrd = (d) => { const i = SHADE_STG.indexOf(d && d.st); return i < 0 ? -1 : i + Math.max(0, Math.min(1, Number(d.p) || 0)) * 0.999; };
// watch (עבודה של משתמש אחר, למנהל) — לפי האחוז הכללי; stage — לפי השלב והאחוז שבו
const shadeBehind = (cd, m) => (cd.k === 'stage' ? shadeOrd(m) >= 0 && shadeOrd(cd) > shadeOrd(m) : cd.k === 'watch' && m.k === 'watch' && (Number(cd.p) || 0) > (Number(m.p) || 0));
self.addEventListener('push', (event) => {
  let m = {};
  try { m = event.data ? event.data.json() : {}; } catch (e) { m = {}; }
  const title = String(m.t || 'THE SNOWBALL').slice(0, 80);
  // הקישור תמיד בכתובת שבה נרשמה ההתראה (שלב 4: גם ב־studio[-staging].thesnowball.app) — מההודעה רק מזהה העבודה
  const hm = /^https:\/\/[^#\s]*(#studio=j[A-Za-z0-9_-]{20})$/.exec(String(m.u || ''));
  // 27/10/2026: התראת מחיר מגרף הנרות (k:'px') — נפתחת בגרף של המניה (#chart=SYM), תג לכל התראה
  const cm = m.k === 'px' ? /^#chart=([A-Za-z0-9.^=%-]{1,40})$/.exec(String(m.u || '')) : null;
  // 29/10/2026: ניטור משתמשים (למנהל) — עבודה של משתמש אחר בתג משלה (watch-<עבודה>), נפתחת במרכז הניהול על העבודה החיה
  const wk = /^(watch|watch_end|watch_clear|cap80|daily|spend)$/.test(String(m.k || ''));
  const wm = wk ? /^https:\/\/admin(-staging)?\.thesnowball\.app\/#(live=j[A-Za-z0-9_-]{20}|people|use|act|ov)$/.exec(String(m.u || '')) : null;
  const url = wm ? wm[0] : './' + (hm ? hm[1] : cm ? cm[0] : '');
  const tag = wk ? (m.j ? 'watch-' + m.j : 'adm-' + m.k) : cm ? 'px-' + String(m.i || cm[1]).slice(0, 40) : m.j ? 'studio-' + m.j : 'studio', at = Number(m.at) || 0;
  // 27/10/2026 (בקשת המשתמש): כל שלב בעבודה = אותה התראה (תג לעבודה) שמתחלפת — שקטה, עם פס של השלב.
  // סוף / שאלה / אישור / עצירה — מחליפים אותה עם צליל. הודעה ישנה שהגיעה באיחור (שירות ה־push לא שומר על סדר) לא דורסת חדשה
  const stage = m.k === 'stage' || m.k === 'watch';   // watch = ההתקדמות של משתמש אחר — שקטה ונשארת כמו התראת שלב
  event.waitUntil((async () => {
    let cur = null;
    try { cur = (await self.registration.getNotifications({ tag }))[0] || null; } catch (e) {}
    const cd = cur && cur.data || {};
    const behind = stage && cur && shadeBehind(cd, m);   // ראו SHADE_STG
    if (cur && (behind || at && cd.at > at)) return self.registration.showNotification(cur.title, { body: cur.body, icon: 'icon-192.png', badge: 'favicon-48.png',
      lang: 'he', dir: 'auto', tag, renotify: false, silent: true, data: cd, actions: cur.actions || [] });
    return self.registration.showNotification(title, {
      body: String(m.b || '').slice(0, 160), icon: 'icon-192.png', badge: 'favicon-48.png', lang: 'he', dir: 'auto',
      tag, renotify: !stage, silent: stage, requireInteraction: false, data: { url, at, k: String(m.k || ''), st: m.k === 'stage' ? String(m.st || '') : '', p: stage ? Number(m.p) || 0 : 0 },
      // מ9: עבודה שהסתיימה — ישר לנגן או לעורך (האפליקציה בודקת שאפשר; אחרת נשארת בדף העבודה)
      actions: m.k === 'done' && url !== './' ? [{ action: 'play', title: 'צפייה' }, { action: 'subs', title: 'עריכה' }] : [],
    });
  })());
});
/* 27/10/2026 (בקשת המשתמש: "ההתראה נשארת תמיד לאורך כל העבודה, גם אם סגר אותה בטעות או לחץ עליה"): התראת שלב (k:'stage')
   לא נסגרת בלחיצה, ואם נסגרה (החלקה, או אנדרואיד סגר אותה בלחיצה) — מוצגת מחדש מיד, בשקט. רק התראת הסוף/שאלה/עצירה
   מחליפה אותה (אותו תג). SHADE_KEEP: התראה שלא התעדכנה 3 שעות — העבודה כבר לא רצה (סוף שלא הגיע), אפשר לסגור */
const SHADE_KEEP = 3 * 3600e3;
const shadeKeep = (d) => !!d && (d.k === 'stage' || d.k === 'watch') && Date.now() - (Number(d.at) || 0) < SHADE_KEEP;
function shadeAgain(n) {
  return self.registration.showNotification(n.title, { body: n.body, icon: n.icon, badge: n.badge, lang: n.lang, dir: n.dir,
    tag: n.tag, renotify: false, silent: true, data: n.data }).catch(() => {});
}
self.addEventListener('notificationclose', (event) => {
  if (shadeKeep(event.notification.data)) event.waitUntil(shadeAgain(event.notification));
});
self.addEventListener('notificationclick', (event) => {
  const n = event.notification, keep = shadeKeep(n.data);
  if (!keep) n.close();
  let u = (n.data && n.data.url) || './';
  if ((event.action === 'play' || event.action === 'subs') && u.includes('#studio=')) u += '&v=' + event.action;
  event.waitUntil((async () => {
    if (keep) await shadeAgain(n);   // אנדרואיד עלול לסגור בלחיצה — נשארת
    return openAt(u, event.action === 'play' || event.action === 'subs' ? event.action : '');
  })());
});
/* פתיחת הקישור. דף פתוח + עבודה — הודעה (studio-app.js פותח את העבודה): navigate נכשל בשקט בחלון שלא בשליטת ה־SW,
   והמשתמש נשאר בדף הקודם ("לחצתי על ההתראה ונפתח פרויקט חדש", 27/10/2026) */
async function openAt(u, v) {
  const url = new URL(u, self.registration.scope).href;
  if (!url.startsWith(self.registration.scope)) return self.clients.openWindow(url);   // 29/10/2026: מרכז הניהול (התראת מנהל) — חלון משלו, לא על חשבון Studio הפתוח
  const jm = /#studio=(j[A-Za-z0-9_-]{20})/.exec(u);
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const w of wins) {
    if (!w.url.startsWith(self.registration.scope) || !('focus' in w)) continue;
    if (jm) { try { w.postMessage({ snb: 'studioJob', j: jm[1], v }); } catch (e) {} return w.focus(); }
    try { await w.navigate(url); } catch (e) {}
    return w.focus();
  }
  return self.clients.openWindow(url);
}

/* 23/10/2026 (בקשת המשתמש: העלאה שממשיכה גם כשהאפליקציה סגורה): הסרטון עלה ב־Background Fetch (studiobg.js).
   ה־service worker מסיים את ההעלאה ורושם את הסרטון בשרתון (op:'r2bgDone') — גם כשאף דף לא פתוח. ההרשאה = מפתח הסיום
   החד־פעמי שהדף שמר ב־snb-bgup (בלי התחברות). לא הצליח — ההתראה אומרת לפתוח את Studio, וההעלאה הרגילה בדף מסיימת /
   ממשיכה מהחלקים החסרים. רק מזהים שמתחילים ב־snbup- (BG_PREFIX) */
const BG_ID_RE = /^snbup-(j[A-Za-z0-9_-]{20})$/;
const BG_TXT = {
  he: { ok: 'הסרטון עלה — Studio ממשיך לבד', open: 'הסרטון עלה — פתחו את Studio כדי לסיים', fail: 'ההעלאה נעצרה — פתחו את Studio כדי להמשיך' },
  en: { ok: 'Video uploaded — Studio carries on', open: 'Video uploaded — open Studio to finish', fail: 'Upload stopped — open Studio to continue' },
};
function bgRec(id, del) {
  return new Promise((ok) => {
    const r = indexedDB.open('snb-bgup', 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('u')) r.result.createObjectStore('u'); };
    r.onerror = () => ok(null);
    r.onsuccess = () => {
      const tx = r.result.transaction('u', del ? 'readwrite' : 'readonly');
      const q = del ? tx.objectStore('u').delete(id) : tx.objectStore('u').get(id);
      tx.oncomplete = () => ok(del ? null : q.result || null); tx.onerror = () => ok(null);
    };
  });
}
const BG_API_RE = /^https:\/\/(api(-staging)?\.thesnowball\.app|ibkr-proxy-wine\.vercel\.app)$/;
async function bgFinish(job, rec) {
  for (const base of (rec.apis || []).filter((x) => BG_API_RE.test(x))) {
    try {
      const r = await fetch(base + '/api/studio', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'r2bgDone', job, id: rec.fid, up: rec.up, fk: rec.fk }) });
      const j = await r.json().catch(() => null);
      if (j && j.ok) return true;
      if (r.status === 403 || r.status === 404 || r.status === 400) return false;   // לא תקלת רשת — שרתון אחר לא יעזור
    } catch (e) {}
  }
  return false;
}
async function bgTell(m) {
  for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) c.postMessage(m);
}
self.addEventListener('backgroundfetchsuccess', (event) => {
  const m = BG_ID_RE.exec(event.registration.id);
  if (!m) return;
  event.waitUntil((async () => {
    const rec = await bgRec(event.registration.id);
    const t = BG_TXT[rec && rec.l === 'en' ? 'en' : 'he'];
    const ok = !!(rec && await bgFinish(m[1], rec));
    if (ok) await bgRec(event.registration.id, true);
    try { await event.updateUI({ title: ok ? t.ok : t.open }); } catch (e) {}
    await bgTell({ snbBg: m[1], ok });
  })());
});
self.addEventListener('backgroundfetchfail', (event) => {
  const m = BG_ID_RE.exec(event.registration.id);
  if (!m) return;
  event.waitUntil((async () => {
    const rec = await bgRec(event.registration.id);
    try { await event.updateUI({ title: BG_TXT[rec && rec.l === 'en' ? 'en' : 'he'].fail }); } catch (e) {}
    await bgTell({ snbBg: m[1], ok: false, why: event.registration.failureReason || '' });
  })());
});
self.addEventListener('backgroundfetchabort', (event) => {
  if (BG_ID_RE.test(event.registration.id)) event.waitUntil(bgRec(event.registration.id, true));
});
self.addEventListener('backgroundfetchclick', (event) => {
  const m = BG_ID_RE.exec(event.registration.id);
  if (!m) return;
  event.waitUntil(openAt('./#studio=' + m[1], ''));   // 27/10/2026: גם כש־Studio כבר פתוחה — ישר לעבודה
});
