// שלב 3ג–3ד בתוכנית שלוש האפליקציות (13/10/2026): academy.html ו־studio.html — דפים עצמאיים בלי app.js.
// לכל דף: ה־CSP זהה לזה של index.html חוץ מה־hash של הסקריפט שבדף (מקור חדש = בכל הדפים), סדר הסקריפטים, בלי התיק,
// ההבדלים במצב עצמאי במודול (SA), והקבצים במטמון של ה־SW.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const idx = read('index.html');
const sw = read('sw.js');
const csp = (html) => (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
const APPS = [
  { app: 'academy', mod: 'library.js', open: 'openLibrary', shell: 'LIB_SHELL', st: 'lib', cls: 'lib-open' },
  { app: 'studio', mod: 'studio.js', open: 'openStudio', shell: 'STUDIO_SHELL', st: 'studio', cls: 'studio-open' },
];

for (const A of APPS) {
  const page = read(A.app + '.html');
  const inline = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  ok(inline.length === 1, A.app + ': סקריפט inline אחד בדיוק');
  const h = "'sha256-" + crypto.createHash('sha256').update(inline[0]).digest('base64') + "'";
  ok(csp(page).includes(h), A.app + ': ה־hash של הסקריפט ב־CSP (שינוי בסקריפט = לעדכן)');
  ok(csp(page).replace(/'sha256-[^']+'/g, 'H') === csp(idx).replace(/'sha256-[^']+'/g, 'H'), A.app + ': ה־CSP זהה ל־index.html (חוץ מה־hash) — מקור חדש נכנס לכולם');
  ok(/if\(self!==top\)/.test(inline[0]) && inline[0].includes("classList.add('" + A.cls + "')") && inline[0].includes('h.' + A.st), A.app + ': מסגרת זרה, ערכת נושא ווילון ברענון');
  ok(!/on(load|error|click)=/.test(page), A.app + ': בלי מאזינים בתוך HTML');
  const srcs = [...page.matchAll(/<script (?:type="module" )?src="([^"]+)"/g)].map((m) => m[1]);
  ok(JSON.stringify(srcs) === JSON.stringify(['firebase-config.js', 'strings-' + A.app + '.js', 'core.js', 'auth.js', A.app + '-app.js']),
    A.app + ': סדר הסקריפטים — הגדרות → מחרוזות → core → auth → האתחול (מודול, אחרי ה־defer)');
  ok(!/app\.js"|cloud\.js|returns\.js/.test(page.replace(A.app + '-app.js', '')), A.app + ': בלי app.js / cloud.js / returns.js — בלי התיק');

  const boot = read(A.app + '-app.js');
  ok(boot.includes("import { " + A.open + " } from './" + A.mod + "'") && /const sa = \{ auth: A, home: APP_URL\.invest, ready \}/.test(boot) && /if \(SA && SA\.ready\) await SA\.ready/.test(read(A.mod)) && /standalone: sa/.test(boot), A.app + ': האתחול פותח את אותו המודול במצב עצמאי');
  // ההדר המשותף (13/10/2026): אותו shell.js, הלוגו של האפליקציה, והגלובוס בתפריט הפתוח = ההגדרות של האפליקציה
  ok(boot.includes("import { createShell, appBoot, APP_URL, loginGate, accountCard, displayCard, advancedRow, advancedCards } from './shell.js'") && boot.includes("app: '" + A.app + "'") && boot.includes("logo: 'logo-" + A.app + ".webp', logoLg: 'logo-" + A.app + "-lg.webp'") && /onSettings: \(\) => sa\.settings/.test(boot), A.app + ': ההדר המשותף עם הלוגו של ' + A.app);
  // הלוגו (13/10/2026): WebP בצבע מלא — חד יותר מ־PNG של 256 צבעים (pngquant) ובמשקל דומה. 512 = פי 4 מ־128 בהדר, 768 למסך הכניסה (192px)
  { const dim = (f) => { const b = fs.readFileSync(path.join(root, f)); return b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 16) === 'WEBPVP8X' ? [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1, b.length, (b[20] & 16) > 0] : null; };
    const [w, hh, n, al] = dim('logo-' + A.app + '.webp') || []; ok(w === 512 && hh === 512 && al && n < 200000, A.app + ': הלוגו בהדר — WebP של 512 עם שקיפות, <200KB');
    const [w2, h2, n2, al2] = dim('logo-' + A.app + '-lg.webp') || []; ok(w2 === 768 && h2 === 768 && al2 && n2 < 320000, A.app + ': הלוגו למסך הכניסה — WebP של 768 עם שקיפות');
    ok(!fs.existsSync(path.join(root, 'logo-' + A.app + '.png')), A.app + ': בלי ה־PNG הישן');
    for (const [f, sz] of [['icon-' + A.app + '-192.png', 192], ['apple-touch-' + A.app + '.png', 180], ['favicon-' + A.app + '-48.png', 48]]) {
      const b = fs.readFileSync(path.join(root, f)); ok(b.slice(1, 4).toString() === 'PNG' && b.readUInt32BE(16) === sz && page.includes('href="' + f + '"') && read('sw.js').includes("'./" + f + "'"), A.app + ': ' + f + ' — בדף ובמעטפת של sw.js');
    } }
  ok(boot.indexOf('wireCoreBack()') > 0 && boot.indexOf('wireCoreBack()') < boot.indexOf(A.open + '({'), A.app + ': "חזור" של החלונות נרשם לפני המודול (סדר מאזיני popstate)');
  // 13/10/2026 (בקשת המשתמש): מסך הכניסה של Invest גם כאן — רק כשהחיבור ענה "לא מחובר", עם הלוגו והשם של האפליקציה
  ok(new RegExp("if \\(first === 'out'\\) loginGate\\(\\{ app: '" + A.app + "', auth: A, logo: 'logo-" + A.app + "\\.webp', logoLg: 'logo-" + A.app + "-lg\\.webp'").test(boot)
    && boot.indexOf('loginGate(') < boot.indexOf(A.open + '({'), A.app + ': לא מחובר — מסך הכניסה עם הלוגו שלה, לפני פתיחת המודול');
  ok(/pwa_auth_rl/.test(boot) && /Date\.now\(\) - last > 8000/.test(boot), A.app + ': טעינה מחדש כשהחיבור משתנה — עם שומר מפני לולאה');
  // 13/10/2026 (בקשת המשתמש): עמוד ההגדרות — כרטיס החשבון ו"תצוגה" של Invest מ־shell.js, דרך SA (בלי ייבוא בתוך המודול)
  ok(boot.includes("sa.cards = { account: () => accountCard(A, 'icon-" + A.app + "-192.png'), display: displayCard, advRow: advancedRow, advanced: advancedCards };") && !/from '\.\/shell\.js'/.test(read(A.mod)), A.app + ': הכרטיסים של עמוד ההגדרות מגיעים דרך SA.cards');

  const mod = read(A.mod);
  ok(/if \(SA && !restore\) [^\n]*history\.replaceState\(/.test(mod), A.app + ': הבית מחליף את רשומת הדף — "חזור" ממנו יוצא מהדף');
  ok(/appGo\(SA\.home \|\| '\.\/'\)/.test(mod) && /SA\.auth\.signIn\(\)/.test(mod), A.app + ': "THE SNOWBALL" → Invest, ובלי חיבור — כפתור כניסה');

  const shell = (sw.match(new RegExp('const ' + A.shell + ' = \\[([\\s\\S]*?)\\];')) || [])[1] || '';
  for (const f of [A.app + '.html', A.app + '-app.js', 'strings-' + A.app + '.js', 'core.js', 'auth.js', 'shell.js', 'logo-' + A.app + '.webp', 'logo-' + A.app + '-lg.webp']) ok(shell.includes("'./" + f + "'"), A.app + ': ' + A.shell + ' כולל ' + f);
}
ok(/if \(lvl < 1 && root && !SA\)/.test(read('library.js')) && /if \(!st\.studio && SA\) return;/.test(read('studio.js')), 'עצמאי: אין "חזרה לסקירה" (אין תיק)');
/* ההדר המשותף: כמו ב־Invest — שני כפתורים כשהתפריט סגור, בהיר/כהה רק בפתיחה (החלטת המשתמש); בלי הכותרת הגדולה מתחת ללוגו */
{
  const sh = read('shell.js'), css = read('styles.css');
  ok(/\.appbar-actions \.shell-theme \{ display: none; \}/.test(css) && /\.appbar-actions\.menu-open \.shell-theme \{ display: flex;/.test(css), 'shell: בהיר/כהה מופיע רק כשהתפריט פתוח');
  ok(/acts\.append\(theme, langWrap, menuWrap\)/.test(sh) && sh.includes("btnFacesHTML(ICON_GLOBE, ICON_GEAR)") && sh.includes("btnFacesHTML(ICON_MENU, ICON_CLOSE)"), 'shell: הסדר והפנים של הכפתורים כמו ב־Invest');
  ok(/modalPush\(\(\) => setOpen\(false\)\)/.test(sh) && /window\.snbMenuClose = /.test(sh) && /window\.snbMenuClose && window\.snbMenuClose\(\)/.test(read('studio.js')), 'shell: "חזור" סוגר את התפריט (גם דרך CloseWatcher של הסטודיו)');
  ok(/if \(shell\) hrow\.textContent = ''/.test(read('library.js')) && /if \(SA && SA\.shell\) \{ SA\.shell\.setStatus\(pill\); p\.append\(SA\.shell\.el\); \}/.test(read('studio.js')), 'עצמאי: בלי "ספרייה" / "תרגום סרטונים" מתחת ללוגו (בקשת המשתמש)');
  ok(/\.lib-root button:not\(\.appbar button[,)]/.test(read('library.css')), 'האיפוס של כפתורי הספרייה לא חל על ההדר');
  ok(require(path.join(root, 'tools/coregen.js')).APPS.academy.includes('shell.js') && require(path.join(root, 'tools/coregen.js')).APPS.studio.includes('shell.js'), 'coregen: המחרוזות של shell.js בשתי האפליקציות');
}
ok(/\[#&\]studio=\(j\[A-Za-z0-9_-\]\{20\}\)/.test(read('studio-app.js')), 'studio.html: קישור מהתראה (#studio=) פותח את העבודה');
/* אופליין: ניווט לדף עצמאי מקבל את הדף עצמו — גם בכתובת בלי סיומת (Cloudflare: academy.html → /academy). מריצים את sw.js ב־vm */
{
  const vm = require('vm');
  const L = {};
  const BASE = 'https://staging.thesnowball.app/';
  const cached = { [BASE]: 'INVEST', [BASE + 'index.html']: 'INVEST',   // './' = דף השורש של הכתובת (תמיד במעטפת)
    [BASE + 'academy.html']: 'ACADEMY', [BASE + 'studio.html']: 'STUDIO' };
  const norm = (k) => { const u = new URL(typeof k === 'string' ? k : k.url, BASE); return u.origin + u.pathname; };
  const caches = { match: async (k) => cached[norm(k)] || undefined, open: async () => ({ put: async () => {} }), keys: async () => [] };
  const self = { addEventListener: (k, f) => { L[k] = f; }, location: { origin: 'https://staging.thesnowball.app' }, registration: { scope: BASE }, clients: {} };
  vm.runInNewContext(sw, { self, caches, fetch: () => Promise.reject(new Error('offline')), URL, Promise, console, Response: function () {}, setTimeout, crypto: {} });
  const nav = (p) => new Promise((res) => L.fetch({ request: { method: 'GET', url: BASE + p, mode: 'navigate' }, respondWith: (pr) => pr.then(res, () => res('ERR')) }));
  (async () => {
    const r = await Promise.all(['academy', 'academy.html', 'studio', 'studio?x=1', 'nothing'].map(nav));
    ok(r.join() === 'ACADEMY,ACADEMY,STUDIO,STUDIO,INVEST', 'אופליין: /academy ו־academy.html → Academy, /studio → Studio, דף לא מוכר → התיק (' + r.join() + ')');
      })();
}
// ---------- עמוד ההגדרות של Academy ו־Studio = השפה של ההגדרות ב־Invest (13/10/2026)
{
  const sh = read('shell.js'), cl = read('cloud.js'), idx = read('index.html');
  // כרטיס החשבון: אותו DOM כמו renderAccountCard ב־cloud.js — אותן מחלקות, אותם אייקונים
  ok(/card\.id = 'accountCard'/.test(sh) && /box\.id = 'accountInfo'/.test(sh) && /#accountCard > h2 \{ display: none; \}/.test(read('styles.css')), 'shell: #accountCard / #accountInfo כמו ב־Invest');
  for (const c of ["'acc-id'", "'acc-txt'", "'ios-list'", "'ios-row ios-row-btn'", "'acc-out'", "'acc-av'", "'ios-row-ic'", "'ios-row-lbl'"]) ok(sh.includes(c), 'shell: המחלקה ' + c + ' של כרטיס החשבון');
  for (const k of ['out', 'phone', 'cloud']) {
    const m = new RegExp(k + ": '(<svg[^']+)'").exec(sh);
    ok(m && cl.includes(m[1]), 'shell: האייקון ' + k + ' זהה ל־cloud.js');
  }
  ok(/t\('localModeTitle'\)/.test(sh) && /t\('googleSignIn'\)/.test(sh) && /'icon-192\.png'/.test(sh), 'shell: לא מחובר — "מצב מקומי" וכניסה; תמונה חסרה → icon-192 (כמו Invest)');
  // כרטיס תצוגה: אותן מחלקות של index.html, שלוש אפשרויות לשפה ולערכה (בלי מטבע)
  ok(/'card display-card'/.test(sh) && /'display-row stack'/.test(sh) && /'lang-toggle'/.test(sh) && /'lang-opt'/.test(sh) && idx.includes('class="card display-card"'), 'shell: כרטיס "תצוגה" במחלקות של Invest');
  ok(/\['system', t\('themeSystem'\)\]/.test(sh) && /setThemeMode\(v\)/.test(sh) && !/curUSD|curILS/.test(sh), 'shell: שפה וערכה עם "מערכת", בלי מטבע');
  // Academy: עמוד בפני עצמו (לא גיליון), ו־Studio: כל מקטע = כרטיס
  const lib = read('library.js'), st = read('studio.js');
  ok(/function openAcademySettings\(\) \{ if \(!\(ui\.view && ui\.view\.settings\)\) goView\(\{ settings: 1 \}\); \}/.test(lib) && /if \(ui\.view && ui\.view\.settings\) return renderSettings\(\);/.test(lib), 'Academy: ההגדרות = עמוד בספרייה (רשומה בהיסטוריה)');
  ok(/home\.append\(C\.account\(\), C\.advRow\(\(\) => goView\(\{ advanced: 1 \}\)\), C\.display\(\)\)/.test(lib) && /\.lib-root button:not\(\.appbar button, \.card button\)/.test(read('library.css')), 'Academy: החשבון ותצוגה; האיפוס של כפתורי הספרייה לא נוגע בכרטיסים');
  const ps = st.slice(st.indexOf('function pageSettings('), st.indexOf('function pageEng(p)'));   // העמוד הראשי בלבד
  // 25/10/2026 (בקשת המשתמש — עיצוב נקי כמו Apple): החשבון בראש העמוד, התצוגה והמתקדמות בסוף
  ok(/p\.append\(C\.account\(\)\)/.test(ps) && /C\.display\(\), C\.advRow\(\(\) => go\('adv'\)\)/.test(ps) && ps.indexOf('C.account()') < ps.indexOf('C.display()') && !/secT\(/.test(ps), 'Studio: החשבון של Invest בראש העמוד, התצוגה והמתקדמות בסוף');
  // 13/10/2026 (בקשת המשתמש: "כמו ש־Apple הייתה מתכננת"): העמוד הראשי = שתי קבוצות של שורות, כל נושא בעמוד משנה
  { const rows = [...ps.matchAll(/onClick: \(\) => go\('(\w+)'\)/g)].map((m) => m[1]).join();
    ok(rows === 'eng,defs,tower,store,push,guide', 'Studio: השורות בעמוד הראשי — ' + rows);
    ok((ps.match(/setCard\(/g) || []).length === 3 && /setCard\(T\('studioGrpTr'\)/.test(ps) && /setCard\(T\('studioGrpGen'\)/.test(ps) && /setCard\(T\('studioLrnGrp'\)/.test(ps), 'Studio: שלוש קבוצות — תרגום, כללי, ופרטיות ושיפור (25/10/2026)'); }
  for (const [v, fn] of [['eng', 'pageEng'], ['defs', 'pageDefs'], ['store', 'pageStore'], ['push', 'pagePush']]) ok(new RegExp("else if \\(ui\\.view === '" + v + "'\\) " + fn + '\\(p\\);').test(st) && st.includes('function ' + fn + '(p) {'), 'Studio: עמוד המשנה ' + v);
  { const sec = (f) => { const a = st.indexOf('function ' + f + '(p) {'); return st.slice(a, st.indexOf('\n}\n', a)); };
    ok(/T\('studioConnSub'\)/.test(sec('pageEng')) && /go\('connect'\)/.test(sec('pageEng')) && /go\('server'\)/.test(sec('pageEng')), 'Claude: מי מתרגם, האשף והשרת — במקום אחד');
    ok(/connectDrive/.test(sec('pageStore')) && /s\.wifi = !s\.wifi/.test(sec('pageStore')), 'אחסון והעלאה: Drive ו"רק ב־Wi‑Fi"');
    ok(/pushOn\(\)/.test(sec('pagePush')) && /pushTest/.test(sec('pagePush')), 'התראות: המתג והבדיקה');
    ok(/go\('def', 'mode'\)/.test(sec('pageDefs')) && /go\('lang', 'def'\)/.test(sec('pageDefs')) && /go\('def', 'out'\)/.test(sec('pageDefs')) && /go\('def', 'style'\)/.test(sec('pageDefs')), 'ברירות מחדל: ארבע השורות'); }
  ok(/x === 'connect' \|\| \(x === 'def' && y === 'cap'\) \? \['eng', null\]/.test(st) && /x === 'def' \|\| \(x === 'lang' && y === 'def'\) \? \['defs', null\]/.test(st), 'Studio: "חזור" מהפרטים — לעמוד המשנה שממנו באו');
  ok(/x\.k === 'drive_revoked' \? \(\) => go\('store'\)/.test(st) && /T\('studioConnectNow'\), \(\) => go\('eng'\)/.test(st), 'Studio: קישורים מהתראות ומעבודה — ישר לעמוד הנכון');
  // "אפשרויות מתקדמות" כמו ב־Invest (13/10/2026): שורה בהגדרות → עמוד עם האפליקציה לאנדרואיד, גרסה וניקוי מטמון
  for (const id of ['advancedCard', 'widgetCard', 'appInfoCard', 'widgetApk', 'widgetHow', 'appVersion', 'clearCache']) ok(sh.includes("id = '" + id + "'") && idx.includes('id="' + id + '"'), 'shell: #' + id + ' כמו ב־index.html');
  { const href = /href="(https:\/\/github\.com\/[^"]+\.apk)"/.exec(idx)[1]; ok(sh.includes("APK_URL = '" + href + "'"), 'shell: אותו קישור ל־APK כמו ב־Invest'); }
  ok(/caches\.delete/.test(sh) && /r\.unregister\(\)/.test(sh) && /location\.reload\(\)/.test(sh), 'shell: ניקוי מטמון = כל המטמונים + ביטול ה־SW + טעינה מחדש (כמו #clearCache)');
  ok(/appVersionLabel\(\)/.test(sh) && /const APP_VERSION = '(v\d+)'/.exec(read('core.js'))[1] === /const APP_VERSION = '(v\d+)'/.exec(read('app.js'))[1], 'הגרסה ב־core.js = ב־app.js (אזור <core>) — Academy ו־Studio מציגות את אותו המספר');
  ok(/if \(ui\.view && ui\.view\.advanced\) return renderAdvanced\(\);/.test(lib) && /else if \(ui\.view === 'adv'\) pageAdvanced\(p\);/.test(st) && /x === 'guide' \|\| x === 'adv' \|\|[^)]*\) \? \['settings', null\]/.test(st), 'Academy ו־Studio: עמוד "אפשרויות מתקדמות" ש"חזור" ממנו מגיע להגדרות');
  ok(!/large\(T\('studioSettings'\)\)/.test(ps) && /if \(big\) big\.remove\(\)/.test(lib), 'בלי כותרת "הגדרות" בעמודי ההגדרות (בקשת המשתמש)');
  // 13/10/2026 (בקשת המשתמש): בלי הבר האפור — ה־+ בהדר מימין לגלובוס, הגיבוי וההוספה בהגדרות, הבועה בהדר
  { const aa = read('academy-app.js');
    ok(/const act = o\.action \|\| null;/.test(sh) && /btnFacesHTML\(act\.icon, themeIcon\(\)\)/.test(sh) && /if \(act && !isOpen\(\)\) \{ act\.on\(\); return; \}/.test(sh), 'shell: כפתור פעולה — סגור = הפעולה, פתוח = בהיר/כהה (כמו $ ב־Invest)');
    ok(/action: \{ label: t\('libImport'\), on: \(\) => sa\.addBook && sa\.addBook\(\),\s*icon: _IC_PRE \+/.test(aa), 'Academy: ה־+ בהדר = הוספת ספר, אייקון בסגנון של שאר הכפתורים (_IC_PRE)');
    ok(/SA\.addBook = addBookPick/.test(lib) && /function mineCard\(\)/.test(lib) && /home\.append\(mineCard\(\)\)/.test(lib), 'Academy: הגיבוי, ההוספה והאיפוס — בכרטיס "הספרייה שלי" בהגדרות');
    ok(/if \(shell\) \{ bkAdopt\(\); shell\.setStatus\(backupPill\(\)\); if \(shell\.el\.parentNode !== home\) home\.prepend\(shell\.el\); \}\s*else home\.append\(top, hrow\);/.test(lib), 'Academy: בדף העצמאי בלי שורת הכותרת האפורה — בועת הגיבוי בהדר, תמיד');
    // המחרוזות של דפי האפליקציות עצמם נכנסות לקובץ המחרוזות (עד 13/10/2026 התפריט הציג "shellBackup")
    for (const [f, sf] of [['academy-app.js', 'strings-academy.js'], ['studio-app.js', 'strings-studio.js']]) {
      const keys = [...new Set([...read(f).matchAll(/\bt\('([A-Za-z0-9]+)'\)/g)].map((m) => m[1]))], strs = read(sf);
      ok(keys.length && keys.every((k) => strs.includes('"' + k + '":')), f + ': כל המחרוזות ב־' + sf + ' (' + keys.join(', ') + ')');
    }
  }
  // 13/10/2026 (בקשת המשתמש): צבע מערכת לכל אפליקציה — Studio אדום, Academy כחול (הגוונים המדויקים), במקום הירוק של Invest
  { const css = read('styles.css');
    for (const [app, hex] of [['studio', '#FF4656'], ['academy', '#4699FF']]) {
      ok(read(app + '.html').includes('<html lang="he" dir="rtl" data-app="' + app + '" class="lib-curtain lib-restoring">'), app + ': data-app על <html>');
      const m = new RegExp('html\\[data-app="' + app + '"\\] \\{([^}]*)\\}').exec(css);
      ok(m && m[1].includes('--primary: ' + hex + ';') && m[1].includes('--primary-dark: ' + hex + ';') && /--primary-container: rgba\(/.test(m[1]) && /--on-primary: #/.test(m[1]), app + ': --primary = ' + hex);
      ok(new RegExp('html\\[data-app="' + app + '"\\]\\[data-theme="dark"\\] \\{ --on-primary-container: #').test(css), app + ': גוון טקסט על מיכל — גם לכהה');
    }
    ok(/\.studio-ic \{ background: #FF4656; \}/.test(css) && /\.academy-ic \{ background: #4699FF; \}/.test(css) && /\.invest-ic \{ background: #30D158; \}/.test(css), 'אייקון כל אפליקציה בתפריט — בצבע שלה');
    ok(/cls: 'invest-ic'/.test(sh) && /cls: 'academy-ic'/.test(sh) && /cls: 'studio-ic'/.test(sh) && idx.includes('row-link-ic academy-ic'), 'התפריט של Invest ושל ההדר המשותף משתמשים במחלקות האלה');
    const sc = read('studio.css');
    ok(/\.st-root \{ --st-ok: #30D158;/.test(sc) && /\.st-stg\.done \.dot \{ background: var\(--st-ok\)/.test(sc) && /\.st-sdot\.g \{ background: var\(--st-ok\)/.test(sc) && /\.st-tower svg \{[^}]*color: var\(--st-ok\)/.test(sc) && /\.st-sw\.on \{ background: var\(--st-ok\)/.test(sc) && /\.st-ring \.arc \{ stroke: var\(--st-ok\)/.test(sc) && /\.st-cpill\.on i \{ background: var\(--st-ok\)/.test(sc) && /tile\('shield', 'green'\)/.test(st) && /\.st-tile\.t-green \{ background: var\(--st-ok\)/.test(sc) && !/rgba\(48, ?209, ?88/.test(sc.replace(/\.st-root \{ --st-ok[^}]*\}/, '').replace(/\.st-root \.g \{[^}]*\}/, '').replace(/\[data-theme="dark"\] \.st-root \.g \{[^}]*\}/, '')),
      'Studio: "תקין/הושלם" נשאר ירוק (--st-ok) — ✓ באדום נראה כמו שגיאה');
    const lc = read('library.css');
    ok(!/30D158|48, ?209, ?88/i.test(lc), 'library.css: בלי ירוק קשיח — הכל דרך --primary');
    ok(/const accent = \(\) =>/.test(lib) && /::selection \{ background: \$\{accentRgba\(\.32\)\}/.test(lib) && /drawOptions: \{ color: accent\(\) \}/.test(lib) && /createRibbonAsync\(cv, \{ color: accent\(\),/.test(lib) && /x\.fillStyle = accent\(\)/.test(lib), 'library.js: בתוך הספר, בקנבס וב־WebGL — צבע המערכת מ־--primary');
    ok(/srcset = o\.logo \+ ' 512w, ' \+ o\.logoLg \+ ' 768w'; img\.sizes = '128px'/.test(sh) && /img\.sizes = '192px'/.test(sh), 'shell: srcset — הלוגו חד בכל צפיפות מסך (הדר 128px, כניסה 192px)');
  }
  // 25/10/2026 (בקשת המשתמש — כמו ב־Apple): כותרת קטנה מעל הקבוצה, והרשימה עצמה היא הכרטיס (לא כרטיס בתוך כרטיס)
  ok(/h\('section', 'st-setgrp'\)/.test(st) && /if \(title\) c\.append\(secT\(title\)\)/.test(st) && /\.st-setgrp > \.st-sec-t:first-child/.test(read('studio.css')), 'Studio: קבוצה בהגדרות = כותרת קטנה מעליה, הרשימה היא הכרטיס');
}
console.log('# ' + n + ' בדיקות עברו');
