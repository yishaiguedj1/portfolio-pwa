// 14/10/2026 (סרטון המשתמש): כניסה חלקה לכל אפליקציה, ומעבר בין האפליקציות בלי מסך שחור.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL - ' + m); } else console.log('ok - ' + m); };
const app = R('app.js'), idx = R('index.html'), css = R('styles.css');
const fn = (src, name) => { const i = src.indexOf('function ' + name + '('); return i < 0 ? '' : src.slice(i, src.indexOf('\n}\n', i) + 2); };

// Invest: התבנית הריקה של index.html לא מוצגת לפני הציור הראשון
ok(/<html[^>]*class="booting"/.test(idx), 'index.html מתחיל ב־booting');
ok(/html\.booting main, html\.booting \.tabs, html\.booting \.appbar-left \{ visibility: hidden; animation: snbBootShow 0s 5s forwards; \}/.test(css), 'עד הציור הראשון: התוכן, הלשוניות והכפתורים מוסתרים (רשת ביטחון 5 שנ׳)');
ok(/html\.booting \*, html\.booting \*::before, html\.booting \*::after \{ transition: none !important; \}/.test(css), 'בלי מעברים לפני הציור הראשון');
ok(/renderAll\(\);\n    document\.documentElement\.classList\.remove\('booting'\)/.test(app), 'booting יורד אחרי הציור הראשון');
ok(/id="tab-overview" class="tabpage active no-in"/.test(idx) && /opts\.cubeDone \|\| opts\.restore/.test(fn(app, 'switchTab')), 'הטאב הראשון מופיע בלי כניסה מונפשת');
// קישור מהווידג'ט — ישר לטאב שלו
const ctx = { location: { hash: '' }, localStorage: { s: {}, setItem(k, v) { this.s[k] = v; } }, TAB_ORDER: ['overview', 'stocks', 'trades', 'wishlist'], LS_WLACTIVE: 'wl',
  wlLists: () => [{ id: 'a', items: [{ sym: 'NOW' }] }, { id: 'b', items: [{ sym: 'KO' }] }] };
vm.createContext(ctx); vm.runInContext(fn(app, 'bootLinkTab'), ctx);
const tab = (h) => { ctx.location.hash = h; ctx.localStorage.s = {}; return ctx.bootLinkTab(); };
ok(tab('#tab=wishlist&wl=b&app=x&n=1') === 'wishlist' && ctx.localStorage.s.wl === 'b', 'קישור לרשימה: הטאב והרשימה לפני הציור');
ok(tab('#tab=wishlist&wl=a&stock=KO') === 'wishlist' && ctx.localStorage.s.wl === 'b', 'מניה שלא ברשימה מהקישור — הרשימה שבה היא');
ok(tab('#stock=NOW') === 'stocks' && tab('#tab=stocks') === 'stocks' && tab('#app=x') === '' && tab('#tab=evil') === '', 'בלי קישור / טאב לא מוכר — כרגיל');
ok(/const lk = bootLinkTab\(\);\n    if \(lk\) lastTab = lk;/.test(app), 'בהפעלה: הטאב מהקישור במקום הטאב האחרון (בלי קובייה אחר כך)');
ok(/const same = ind\._tab === act\.dataset\.tab, quiet = same \|\| document\.documentElement\.classList\.contains\('booting'\)/.test(fn(app, 'positionTabIndicator')), 'הגלולה לא "נוסעת" במדידה מחדש / לפני הציור');
ok(/behavior: smooth \? 'smooth' : 'auto'/.test(app) && /tabs\._wlOn = on\.dataset\.wl/.test(app), 'שורת הרשימות במקום בפתיחה; חלקה רק בהחלפה');

// Academy / Studio: מצויר מיד כשיש חשבון בטלפון; העיצוב והלוגו לפני הציור
for (const [page, boot, mod, css2, logo] of [['academy.html', 'academy-app.js', 'library.js', 'library.css', 'logo-academy'], ['studio.html', 'studio-app.js', 'studio.js', 'studio.css', 'logo-studio']]) {
  const h = R(page), b = R(boot), m = R(mod);
  ok(h.indexOf('<link rel="stylesheet" href="' + css2 + '"') > 0 && h.indexOf(css2) < h.indexOf('<body>'), page + ': העיצוב של האפליקציה בראש הדף');
  ok(h.includes('<link rel="preload" as="image" href="' + logo + '.webp"') && h.includes('<link rel="modulepreload" href="' + mod + '">'), page + ': הלוגו והמודול נטענים מראש');
  ok(/const first = owned \? 'boot' : await ready;/.test(b) && /o !== 'local' && o !== 'legacy'/.test(b), boot + ': חשבון בטלפון — לא מחכים לחיבור לפני הציור');
  ok(/else if \(first === 'boot'\) ready\.then\(\(st\) => \{ if \(st === 'out'\) loginGate/.test(b), boot + ': התנתקות שמתבררת אחר כך — מסך הכניסה');
  ok(/if \(SA && SA\.ready\) await SA\.ready;/.test(m), mod + ': פעולה שצריכה חשבון מחכה לחיבור');
}
ok(/html\[data-app="studio"\] \.st-root:not\(\.leaving\) \{ animation: none; \}/.test(R('studio.css')), 'Studio מופיע מיד (בלי עלייה של שכבה)');
ok(/growWatch\(root, '\.st-banner'/.test(R('studio.js')) && /now - at > 400\) growIn\(e\)/.test(fn(app, 'growWatch')), 'פס שמופיע בדף מוצג — נפתח ברכות');

// מעבר בין האפליקציות — prerender
const pre = (u) => JSON.stringify({ prerender: [{ source: 'list', urls: u, eagerness: 'immediate' }] });
const hashes = [];
for (const suf of ['', '-staging']) { const U = (a) => 'https://' + a + suf + '.thesnowball.app/'; for (const [x, y] of [['academy', 'studio'], ['invest', 'studio'], ['invest', 'academy']]) hashes.push("'sha256-" + crypto.createHash('sha256').update(pre([U(x), U(y)])).digest('base64') + "'"); }
for (const p of ['index.html', 'academy.html', 'studio.html']) ok(hashes.every((x) => R(p).includes(x)), p + ': ה־CSP מאשר את כללי ה־prerender (6 צירופים)');
const c2 = {}; vm.createContext(c2); vm.runInContext(app.match(/const PRE_RE = [^\n]+/)[0] + '\n' + fn(app, 'preRulesText') + ';this.PRE_RE=PRE_RE;this.preRulesText=preRulesText;', c2);
ok(c2.preRulesText(['https://academy.thesnowball.app/', 'https://studio.thesnowball.app/']) === pre(['https://academy.thesnowball.app/', 'https://studio.thesnowball.app/']), 'הטקסט = מה שה־hash מכסה');
ok(c2.PRE_RE.test('https://studio-staging.thesnowball.app/') && !c2.PRE_RE.test('https://evil.com/') && !c2.PRE_RE.test('academy.html'), 'רק בין כתובות האפליקציות');
ok(/appPrerender\(\[APP_PAGE\.academy, APP_PAGE\.studio\]\)/.test(fn(app, 'setMainMenuOpen')) && /appPrerender\(Object\.keys\(APP_URL\)/.test(R('shell.js')), 'בפתיחת התפריט — Invest וגם Academy/Studio');
ok(/Supports-Loading-Mode: credentialed-prerender/.test(R('_headers')), '_headers: היעד מסכים ל־prerender מאותו אתר');
// אנדרואיד: Academy ו־Studio בתוך האפליקציה
const st = R('android/app/src/main/res/values/strings.xml'), ma = R('android/app/src/main/java/io/github/yishaiguedj1/snowball/MainActivity.kt');
ok(/academy\.thesnowball\.app/.test(st) && /studio\.thesnowball\.app/.test(st) && /setAdditionalTrustedOrigins\(APP_ORIGINS\.filter/.test(ma), 'APK: Academy ו־Studio מקורות מאומתים (בלי שורת כתובת)');

// הציור הראשון = הדף המלא
{ const head = idx.slice(0, idx.indexOf('</head>'));
  ok(/<script src="app\.js" defer><\/script>\n<script src="cloud\.js" defer blocking="render"><\/script>\n<\/head>/.test(idx) && !/<body>[\s\S]*<script src=/.test(idx), 'Invest: הסקריפטים בראש הדף, cloud.js חוסם ציור (blocking="render" עובד רק ב־head)');
  ok(/try \{ if \(typeof window !== 'undefined' && document\.readyState !== 'loading' && typeof window\.snbInit === 'function'\) window\.snbInit\(\); \} catch/.test(R('cloud.js')) && /window\.snbInit = _initOnce;\n  document\.addEventListener\('DOMContentLoaded', _initOnce\);/.test(app), 'האתחול רץ בסוף cloud.js (לפני הציור), DOMContentLoaded גיבוי — פעם אחת');
  ok(/<link rel="preload" as="image" href="logo-header\.png" fetchpriority="high">/.test(head) && /class="brand-logo"[^>]*decoding="sync"/.test(idx), 'הלוגו של Invest בפריים הראשון'); }
for (const [page, mod] of [['academy.html', 'library.js'], ['studio.html', 'studio.js']]) {
  ok(/<html [^>]*class="lib-curtain lib-restoring">/.test(R(page)), page + ': הווילון מההתחלה — הדף מופיע שלם');
  ok(/function curtainDown\(instant\)/.test(R(mod)) && /if \(lg && lg\.decode\) Promise\.race\(\[lg\.decode\(\)/.test(R(mod)), mod + ': הווילון יורד מיד כשמוכן, אחרי שהלוגו פוענח');
}
ok(/\} else curtainDown\(true\);/.test(R('library.js')) && /curtainDown\(!restore\);/.test(R('studio.js')), 'הווילון יורד בכל פתיחה (לא רק ברענון)');
ok(/goJobLink\(jobLink, linkView, 'none'\)/.test(R('studio.js')), 'קישור לעבודה בפתיחה — בלי קובייה על דף שעוד נכנס');
ok(/data-t="' \+ Date\.now\(\)/.test(app) && /Date\.now\(\) - t0 > 90/.test(app), 'לוגו מניה שמגיע באיחור — בדהייה');
// 15/10/2026 (סרטון המשתמש): התפריט "מתרענן" — ההדר נכנס שוב לדף בכל ציור, ואנימציית CSS רצה מחדש
ok(/'menu-drop sh-drop hidden'/.test(R('shell.js')) && /drop\.animate\(\[\{ opacity: 0/.test(R('shell.js')) && /\.menu-drop\.sh-drop:not\(\.hidden\) \{ animation: none; \}/.test(R('styles.css')), 'shell: כניסת התפריט מהקוד — לא רצה מחדש כשההדר עובר');
ok(/for \(const n of \[\.\.\.home\.childNodes\]\) if \(n !== keepHdr\) n\.remove\(\);/.test(R('library.js')) && /if \(shell\.el\.parentNode !== home\) home\.prepend\(shell\.el\);/.test(R('library.js')), 'הספרייה: ההדר נשאר במקומו בציור מחדש');
{ const c = {}; vm.createContext(c); const st = { fx: null, quotes: {} }; let store = { at: Date.now() - 30e3, fx: 3.1, quotes: { A: { close: 1 } }, source: 'Yahoo', session: '' };
  c.state = st; c.lsGet = () => store; c.LS_QUOTES = 'q';
  vm.runInContext(app.match(/const BOOT_QUOTES_MS = [^\n]+/)[0] + '\n' + fn(app, 'bootQuotesFromCache') + ';this.f=bootQuotesFromCache;', c);
  ok(c.f() === true && st.fx === 3.1 && st.quotes.A && st.source === 'Yahoo', 'פתיחה: השער והמחירים מהדקות האחרונות — מיד, בלי "—" ו"דיליי"');
  const st2 = { fx: null, quotes: {} }; c.state = st2; store = { at: Date.now() - 3600e3, fx: 3.2, quotes: { A: { close: 1 } }, source: 'Yahoo' };
  c.f(); ok(st2.fx === 3.2 && !st2.quotes.A && !st2.source, 'מטמון ישן — רק השער (לא מחירים ישנים כ"חי")'); }
ok(/bootQuotesFromCache\(\);\n    renderAll\(\);/.test(app), 'לפני הציור הראשון');
console.log('# ' + (n - bad) + '/' + n);
process.exit(bad ? 1 : 0);
