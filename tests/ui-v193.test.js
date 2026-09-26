// ui-v193.test.js — ביצועים ומעברים (v193): ציור רק של הטאב הנראה, מפתח ציור לעוגה,
// אתחול מיידי מהנתונים המקומיים (ה־SDK של Firebase נטען אחרי הפריים הראשון), שער הדולר באותה
// בקשה, היסטוריה בבקשה אחת מהשרתון, מטמון ריצה ב־SW, ואנימציות בסגנון Apple/Material.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'cloud.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

let n = 0;
function ok(cond, name) {
  n++;
  if (!cond) { console.error('FAIL - ' + name); process.exit(1); }
  console.log('ok - ' + name);
}
const fnBody = (name, len) => { const i = src.indexOf('function ' + name + '('); return i < 0 ? '' : src.slice(i, i + (len || 900)); };

// --- 1. ציור רק של הטאב הנראה ---
ok(/function tabShouldRender\(name\)/.test(src), 'tabShouldRender קיימת');
for (const [fn, tab] of [['renderOverview', 'overview'], ['renderStocks', 'stocks'], ['renderTrades', 'trades'], ['renderWishlist', 'wishlist'], ['renderDeposits', 'deposits'], ['renderPension', 'pension']])
  ok(fnBody(fn, 1400).includes("if (!tabShouldRender('" + tab + "')) return;"), fn + ': יוצאת מוקדם כשהטאב מוסתר (ומסמנת dirty)');
ok(/function renderAll\(opts\) \{\s*_renderForce = !!\(opts && opts\.all\);/.test(src) && /function renderAllInner\(\)/.test(src), 'renderAll({all:true}) מכריח ציור של כל הטאבים (החלפת שפה)');
ok(/if \(tabDirty\[name\]\) \{ const fn = tabRenderer\(name\);/.test(src), 'switchTab מצייר טאב שהשתנה בזמן שהיה מוסתר');
ok(/function setTabPageDirection\(prev, name\)/.test(src) && /'--tab-dx'/.test(src), 'כיוון הכניסה של העמוד נקבע לפי סדר הלשוניות ו־RTL');
ok(/positionTabIndicator\(\); \} catch \(e\) \{\}\s*if \(actTab && actTab\.scrollIntoView\)/.test(src), 'הגלולה נמדדת לפני שהעמוד החדש מוצג (layout כפוי קטן)');

// --- 2. עוגה: מפתח ציור + מטמון פריסה + איחוד ציורי לוגו ---
ok(/canvas\._pieDrawKey === key/.test(src), 'drawPie: פריים זהה (טיק חי בלי שינוי) לא מצויר מחדש');
ok(/state\.pieLayoutCache/.test(src) && /layHit/.test(src), 'drawPie: פריסת התוויות (≤12) נשמרת במטמון');
ok((src.match(/schedulePie\(\)/g) || []).length >= 2 && /function schedulePie\(\)/.test(src), 'לוגו שנטען מצייר מחדש פעם אחת בפריים (rAF), לא לכל תמונה');

// --- 3. fitNumbers: רק הטאב הנראה, קבוצות, זיכרון ---
ok(/const SEL = '\.stat-value, \.lg-pct, \.pension-total';/.test(src) && /'\.tabpage\.active ' \+ x/.test(src), 'fitNumbers: רק בטאב הנראה');
ok(/elm\._fitKey === key/.test(src), 'fitNumbers: אותו טקסט באותו רוחב = בלי מדידה מחדש');

// --- 4. אתחול: ציור מיידי מהמקומי, הענן אחר כך ---
const initI = src.indexOf('let appStarted = false');
const initBlk = src.slice(initI, initI + 2200);
ok(initBlk.indexOf('if (!waitCloud) startApp();') > 0 && initBlk.indexOf('if (!waitCloud) startApp();') < initBlk.indexOf('window.Cloud.boot(startApp)'), 'startApp לפני Cloud.boot — הציור הראשון לא מחכה ל־Firebase');
ok(/if \(dbSig\(\) === bootSig\) return;/.test(initBlk), 'startApp עמיד: הענן מצייר שוב רק אם הנתונים השתנו');
ok(/localStorage\.getItem\('pwa_cloud_user_v1'\) === '1'/.test(initBlk) && /setTimeout\(startApp, 6000\)/.test(initBlk), 'אחסון ריק + משתמש ענן מחובר: מחכים לענן (עד 6 שניות), לא מהבהבים תיק ריק');
ok(/function loadSdk\(\)/.test(cloud) && /sc\.integrity = SDK\[i\]\[1\];/.test(cloud) && /requestAnimationFrame\(\(\) => setTimeout\(go, 0\)\)/.test(cloud), 'cloud.js: ה־SDK נטען דינמית עם SRI אחרי הפריים הראשון');
ok(/localStorage\.setItem\(LS_CLOUD_USER, '1'\)/.test(cloud) && /localStorage\.removeItem\(LS_CLOUD_USER\)/.test(cloud), 'cloud.js: דגל משתמש מחובר נכתב/נמחק לפי מצב ההתחברות');
ok(!/<script src="https:\/\/www\.gstatic\.com/.test(html), 'index.html: בלי תגי סקריפט של Firebase');
ok(/<link rel="preconnect" href="https:\/\/ibkr-proxy-wine\.vercel\.app" crossorigin>/.test(html), 'index.html: preconnect לשרתון');

// --- 5. רשת: שער הדולר באותה בקשה, היסטוריה בבקשה אחת, שרתון ראשון ---
ok(/const FX_SYM = 'USDILS=X';/.test(src) && /liveFetch\(quoteSymbols\(\)\.concat\(\[FX_SYM\]\)\)/.test(src), 'שער הדולר מגיע עם המחירים (בקשה אחת פחות בטעינה)');
ok(/async function histBatchWarm\(syms\)/.test(src) && fnBody('warmHistories', 2500).includes('await histBatchWarm('), 'היסטוריות חסרות: בקשה אחת לשרתון לפני הבריכה');
ok(/if \(!histProxyOff\) \{\s*proxyTried = true;/.test(src), 'היסטוריה: השרתון ראשון (בטלפון Yahoo חוסם), ישירות רק כגיבוי');
ok(/proxyHistory\(list,[^\n]*, 12000\)/.test(src), 'proxyHistQueued: timeout של 12 שניות (לא 6) לבקשה מאוחדת');

// --- 6. Service Worker: מטמון ריצה ללוגואים ול־SDK ---
ok(/const RUNTIME = 'portfolio-pwa-rt-v1';/.test(sw) && /'financialmodelingprep\.com': \/\^\\\/image-stock\\\/\//.test(sw) && /'www\.gstatic\.com': \/\^\\\/firebasejs\\\/\//.test(sw), 'sw.js: לוגואים + firebasejs במטמון ריצה');
ok(/k !== CACHE_NAME && k !== RUNTIME/.test(sw), 'sw.js: activate לא מוחק את מטמון הריצה');
ok(/if \(res && res\.ok\) cache\.put\(request, res\.clone\(\)\);/.test(sw), 'sw.js: רק תשובות תקינות נשמרות (לא opaque)');

// --- 7. תנועה (Apple/Material) ---
ok(/\.tab-ind \{[^}]*transition: transform \.42s/.test(css) && /\.tabs\.has-ind \.tab\.active \{ background: transparent/.test(css), 'גלולה מחליקה בין הלשוניות');
ok(/\.tabpage\.active \{ display: block; animation: tabIn/.test(css) && /@keyframes tabIn/.test(css), 'עמוד נכנס בציר משותף');
ok(/\.stock-body \{ display: none; grid-template-rows: 0fr;/.test(css) && /\.stock\.open \.stock-body, \.stock\.anim \.stock-body \{ display: grid; \}/.test(css), 'גוף כרטיס סגור = display:none (בלי layout); נפתח באנימציית גובה');
ok(/card\.classList\.add\('anim'\)/.test(src) && /body\.addEventListener\('transitionend', onEnd\)/.test(src) && /setTimeout\(done, 450\)/.test(src), 'toggleStock: מצב anim עם transitionend + נפילה לזמן קצוב');
ok(/\.skel \{/.test(css) && /@keyframes skel/.test(css) && /const SKEL_HTML = /.test(src), 'שלד עד המחיר הראשון');
ok(/\.drawn \{ opacity: 1/.test(css) && (src.match(/classList\.add\('drawn'\)/g) || []).length >= 3, 'קנבס מתבהר כשצויר (עוגה, ביצועים, מניה)');
ok(/\[data-theme="dark"\] \.card \{ background: #1C1C1E; \}/.test(css), 'מצב כהה: כרטיס אטום (בלי backdrop-filter על רקע שחור)');
ok((css.match(/prefers-reduced-motion: reduce/g) || []).length >= 6, 'כל אנימציה חדשה מכבדת prefers-reduced-motion');
ok(/function withViewTransition\(fn\)/.test(src) && /withViewTransition\(applyTheme\)/.test(src), 'החלפת ערכה/שפה דרך View Transitions');
ok(/details\.note\[open\] > :not\(summary\) \{ animation: demoIn/.test(css), 'תוכן <details> נכנס ברכות');
ok((css.match(/@keyframes menuDropIn/g) || []).length === 1, 'CSS: בלוק התפריט לא כפול');

// --- 8. ריצה: tabShouldRender / כיוון עמוד ---
function makeSandbox() {
  const store = {};
  let active = null;
  const pages = {};
  const sb = {
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    document: {
      addEventListener() {}, documentElement: { dir: 'rtl' },
      getElementById: (id) => (pages[id] || (pages[id] = { id: id, style: { props: {}, setProperty(k, v) { this.props[k] = v; } } })),
      querySelectorAll: () => [], querySelector: (q) => (q === '.tabpage.active' ? active : null),
      createElement: () => ({ innerHTML: '', classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, style: {} }),
    },
    window: { devicePixelRatio: 1 }, navigator: {}, location: {},
    AbortController, fetch: () => Promise.reject(new Error('no net')),
    setTimeout, clearTimeout, console, Image: class { set src(_) {} },
  };
  vm.createContext(sb);
  vm.runInContext(src, sb);
  return { sb, setActive: (id) => { active = id ? { id: id } : null; }, pages };
}
const { sb, setActive, pages } = makeSandbox();
const R = (code) => vm.runInContext(code, sb);
setActive(null);
ok(R("tabShouldRender('overview')") === true, 'בלי טאב פעיל (בדיקות): מציירים');
setActive('tab-stocks');
ok(R("tabShouldRender('stocks')") === true && R("tabDirty.stocks") === false, 'הטאב הפעיל מצויר');
ok(R("tabShouldRender('overview')") === false && R("tabDirty.overview") === true, 'טאב מוסתר: לא מצויר, מסומן dirty');
ok(R("_renderForce = true; const _r = tabShouldRender('overview'); _renderForce = false; _r") === true && R("tabDirty.overview") === false, 'ציור מלא (renderAll({all:true})): גם טאב מוסתר מצויר וה־dirty מתנקה');
ok(/try \{ renderAllInner\(\); \} finally \{ _renderForce = false; \}/.test(src), 'renderAll מחזיר את הדגל גם אם ציור נכשל');
R("setTabPageDirection('overview', 'stocks')");
ok(pages['tab-stocks'].style.props['--tab-dx'] === '-22px', 'RTL: קדימה = העמוד נכנס משמאל (‎-22px)');
R("setTabPageDirection('stocks', 'overview')");
ok(pages['tab-overview'].style.props['--tab-dx'] === '22px', 'RTL: אחורה = מימין (‎22px)');
R("setTabPageDirection('stocks', 'stocks')");
ok(!pages['tab-stocks'].style.props.x && pages['tab-stocks'].style.props['--tab-dx'] === '-22px', 'אותו טאב: הכיוון לא משתנה');

// גרסאות
const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(ver === 'v193' || /^v(19[3-9]|[2-9]\d\d)$/.test(ver), 'APP_VERSION ≥ v193');
ok(sw.includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');

console.log('\n' + n + ' בדיקות עברו');
