// cashflow-app.test.js — 6/11/2026: Cashflow, גל 2 — הממשק (cashflow.html, cashflow-app.js, cashflow.js, cashflow.css).
// 1. הדף: CSP כמו index.html (חוץ מה־hash), ה־hash של הסקריפט, סדר הסקריפטים, אייקונים ולוגו, המעטפת של sw.js.
// 2. החיבורים: session (APPS), ibkr.js (CORS), firebase-config, functions (השורש), sw.js (ROOT_PAGE), coregen.
// 3. פרטיות: אין אחסון מקומי של נתונים, innerHTML רק לאייקונים קבועים, רק /api/cashflow, "בדקתי" = hash בלבד.
// 4. הפונקציות הטהורות: סכומים ("מינוס" במקום סימן), תאריכים, חודשים, ההתקדמות, הגרף, קודי שגיאה.
// 5. מחרוזות: כל מפתח cf בעברית ובאנגלית. הכל סינתטי — בלי נתונים אמיתיים.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { pathToFileURL } = require('url');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const csp = (html) => (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';

(async () => {
  // ---------------------------------------------------------------- 1. הדף
  const page = read('cashflow.html'), idx = read('index.html'), sw = read('sw.js');
  const inline = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  ok(inline.length === 1, 'סקריפט inline אחד בדיוק');
  ok(csp(page).includes("'sha256-" + crypto.createHash('sha256').update(inline[0]).digest('base64') + "'"), 'ה־hash של הסקריפט ב־CSP');
  ok(csp(page).replace(/'sha256-[^']+'/g, 'H') === csp(idx).replace(/'sha256-[^']+'/g, 'H'), 'ה־CSP זהה ל־index.html (חוץ מה־hash) — מקור חדש נכנס לכולם');
  ok(/if\(self!==top\)/.test(inline[0]) && /pwa_theme_v1/.test(inline[0]), 'מסגרת זרה וערכת נושא לפני הציור');
  ok(!/on(load|error|click)=/.test(page) && /data-app="cashflow"/.test(page), 'בלי מאזינים ב־HTML; data-app="cashflow"');
  const srcs = [...page.matchAll(/<script (?:type="module" )?src="([^"]+)"/g)].map((m) => m[1]);
  ok(JSON.stringify(srcs) === JSON.stringify(['firebase-config.js', 'strings-cashflow.js', 'core.js', 'auth.js', 'cashflow-app.js']), 'סדר הסקריפטים כמו Academy ו־Studio');
  ok(!/app\.js"|cloud\.js|returns\.js/.test(page.replace('cashflow-app.js', '')), 'בלי התיק (app.js / cloud.js)');
  const flow = (sw.match(/const FLOW_SHELL = \[([\s\S]*?)\];/) || [])[1] || '';
  for (const f of ['cashflow.html', 'cashflow-app.js', 'cashflow.js', 'cashflow.css', 'strings-cashflow.js', 'core.js', 'auth.js', 'shell.js', 'logo-cashflow.webp', 'logo-cashflow-lg.webp']) ok(flow.includes("'./" + f + "'"), 'FLOW_SHELL כולל ' + f);
  for (const [f, sz] of [['icon-cashflow-192.png', 192], ['apple-touch-cashflow.png', 180], ['favicon-cashflow-48.png', 48]]) {
    const b = fs.readFileSync(path.join(root, f));
    ok(b.slice(1, 4).toString() === 'PNG' && b.readUInt32BE(16) === sz && page.includes('href="' + f + '"') && flow.includes("'./" + f + "'"), f + ' — בדף ובמעטפת');
  }
  { const dim = (f) => { const b = fs.readFileSync(path.join(root, f)); return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1, b.length, (b[20] & 16) > 0]; };
    const [w, h, sz, al] = dim('logo-cashflow.webp'); ok(w === 512 && h === 512 && al && sz < 200000, 'הלוגו בהדר — WebP 512 עם שקיפות');
    const [w2, h2, sz2, al2] = dim('logo-cashflow-lg.webp'); ok(w2 === 768 && h2 === 768 && al2 && sz2 < 320000, 'הלוגו למסך הכניסה — WebP 768'); }
  ok(/\[FLOW_SHELL, '\.\/cashflow\.js'\]/.test(sw) && /'\.\/cashflow\.js': '\.\/cashflow\.html'/.test(sw), 'sw.js: Cashflow נטען מראש בכתובת שלו');

  // ---------------------------------------------------------------- 2. החיבורים
  const boot = read('cashflow-app.js');
  ok(boot.includes("import { openCashflow } from './cashflow.js'") && boot.includes("import { createShell, appBoot, APP_URL, loginGate, accountCard, displayCard, advancedRow, advancedCards } from './shell.js'"), 'האתחול: אותו shell.js ו־openCashflow');
  ok(boot.includes("app: 'cashflow'") && boot.includes("logo: 'logo-cashflow.webp', logoLg: 'logo-cashflow-lg.webp'") && /if \(first === 'out'\) loginGate\(\{ app: 'cashflow'/.test(boot), 'ההדר והכניסה עם הלוגו של Cashflow');
  ok(boot.includes("sa.cards = { account: () => accountCard(A, 'icon-cashflow-192.png'), display: displayCard, advRow: advancedRow, advanced: advancedCards };"), 'כרטיסי ההגדרות דרך SA.cards');
  ok(boot.indexOf('wireCoreBack()') > 0 && boot.indexOf('wireCoreBack()') < boot.indexOf('openCashflow({'), '"חזור" של החלונות נרשם לפני המודול');
  ok(/pwa_auth_rl/.test(boot) && /Date\.now\(\) - last > 8000/.test(boot), 'טעינה מחדש כשהחיבור משתנה — עם שומר מפני לולאה');
  const S = require(path.join(root, 'ibkr-proxy/lib/session.js'));
  ok(S.APPS.includes('cashflow'), 'session: cashflow ב־APPS (ההתחברות המשותפת)');
  ok(S.appForOrigin('https://cashflow.thesnowball.app', 'prod') === 'cashflow' && S.appForOrigin('https://cashflow-staging.thesnowball.app', 'staging') === 'cashflow', 'session: המקור → cashflow (ייצור וניסוי)');
  ok(/invest\|academy\|studio\|account\|admin\|cashflow\)\\\.thesnowball/.test(read('ibkr-proxy/lib/ibkr.js')) && /account\|admin\|cashflow\)-\)\?staging/.test(read('ibkr-proxy/lib/ibkr.js')), 'ibkr.js: CORS לכתובת של Cashflow');
  { const sb = { window: {}, location: { hostname: 'cashflow.thesnowball.app' } }; sb.window.location = sb.location; sb.self = sb.window;
    const fc = read('firebase-config.js');
    ok(/APP_HOST_RE = \/\^\(invest\|academy\|studio\|account\|admin\|cashflow\)/.test(fc) && /PROD_HOST_RE = \/\^\(\(invest\|academy\|studio\|account\|admin\|cashflow\)/.test(fc), 'firebase-config: cashflow בכתובות (השרתון = api.thesnowball.app)'); }
  { const src = read('functions/index.js').replace(/export function/g, 'function') + '\nmodule.exports = { rootPage };';
    const m = { exports: {} }; vm.runInNewContext(src, { module: m, URL, Response: {} });
    ok(m.exports.rootPage('cashflow.thesnowball.app') === '/cashflow' && m.exports.rootPage('cashflow-staging.thesnowball.app') === '/cashflow', 'functions: השורש של cashflow מגיש את cashflow.html'); }
  ok(/\^\(academy\|studio\|cashflow\)\(-staging\)\?/.test(sw), 'sw.js: ROOT_PAGE של cashflow');
  ok(require(path.join(root, 'tools/coregen.js')).APPS.cashflow.includes('cashflow.js'), 'coregen: מחרוזות ל־Cashflow');
  ok(/app === 'cashflow' \? \[info\]/.test(read('shell.js')) && /cashflow: \(\) => t\('loginSubCashflow'\)/.test(read('shell.js')), 'shell: בלי APK ל־Cashflow (גל 4), וכותרת במסך הכניסה');

  // ---------------------------------------------------------------- 3. פרטיות
  const mod = read('cashflow.js');
  const code = mod.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok(!/localStorage|sessionStorage|indexedDB|caches\./.test(code), 'שום נתון פיננסי לא נשמר בטלפון (בלי localStorage / IndexedDB / מטמון)');
  const inner = [...mod.matchAll(/\.innerHTML = ([^;]+);/g)].map((m) => m[1]);
  ok(inner.length > 0 && inner.every((x) => /^SVG\(|^'<svg/.test(x.trim())), 'innerHTML רק לאייקונים קבועים — טקסט חיצוני תמיד textContent');
  ok((mod.match(/fetch\(/g) || []).length === 1 && /base \+ '\/api\/cashflow'/.test(mod) && /cache: 'no-store'/.test(mod), 'קריאת רשת אחת בלבד: POST /api/cashflow, no-store');
  ok(/api\('seen', \{ key: f\._k, on \}\)/.test(mod) && /slice\(0, 8\)/.test(mod), '"בדקתי" שולח רק hash של 16 תווים');
  ok(!/riseup_pat|RISEUP_PAT/.test(mod + boot + page), 'אין טוקן של רייזאפ בצד הלקוח');
  ok(/const KEYS = \['month', 'home', 'review'\]/.test(mod) && /nav\.hidden = v === 'settings'/.test(mod), 'החוגה: חודש, בית (באמצע), לבדוק; בלי הגדרות');

  // ---------------------------------------------------------------- 4. הפונקציות הטהורות
  const STR = vm.runInNewContext(read('strings-cashflow.js') + ';STRINGS');
  let lang = 'he';
  globalThis.getLang = () => lang;
  globalThis.t = (k, v) => { let s = STR[lang][k] || k; for (const x of Object.keys(v || {})) s = s.split('{' + x + '}').join(String(v[x])); return s; };
  const tmp = path.join(os.tmpdir(), 'cf-' + process.pid + '.mjs');
  fs.writeFileSync(tmp, mod);
  const M = await import(pathToFileURL(tmp).href);
  fs.unlinkSync(tmp);
  ok(M.money(12345.6) === '12,346 ₪' && M.money(49.9) === '49.90 ₪' && M.money(50) === '50 ₪', 'סכום: "12,346 ₪", אגורות רק מתחת ל־100');
  ok(M.money(-1200) === 'מינוס 1,200 ₪' && M.money(-0.001) === '0 ₪' && M.money(null) === '—', 'שלילי — "מינוס", בלי סימן מינוס');
  lang = 'en'; ok(M.money(-1200) === 'minus 1,200 ₪', 'באנגלית — minus'); lang = 'he';
  ok(M.dayMonth('2026-10-04') === '4.10' && M.monthLabel('2026-11') === '11/2026' && M.addMonth('2026-01', -1) === '2025-12' && M.addMonth('2026-12', 1) === '2027-01', 'תאריך 4.10, חודש תזרים 11/2026, מעבר שנה');
  const pr = M.spendProgress({ fixedExpensesArrived: 910, expectedFixedExpenses: 3880, trackingExpected: 4200, trackingLeft: 2600, variableExpenseSoFar: 1500 });
  ok(pr.spent === 4010 && pr.planned === 9580 && Math.abs(pr.ratio - 4010 / 9580) < 1e-9, 'יצאו מתוך צפויים: קבועות + מעקב בפועל + משתנות');
  const bars = M.netBars({ month: '2026-10', totals: { net: 4720 }, surplus: { perMonth: [{ month: '2026-09', surplus: 5600 }, { month: '2026-07', surplus: 3100 }, { month: '2026-08', surplus: -1200 }] } });
  ok(bars.map((x) => x.month).join() === '2026-07,2026-08,2026-09,2026-10' && bars[3].sel && bars[1].net === -1200, 'הגרף: מהישן לחדש, החודש הנבחר מסומן');
  ok(M.errKey('riseup_token_rejected') === 'cfErrToken' && M.errKey('off') === 'cfErrOff' && M.errKey('weird') === 'cfErrGeneric', 'קוד שגיאה → הודעה');
  ok(M.findingRaw('2026-10', { type: 'duplicate', merchant: 'X', amount: 120 }) === '2026-10|duplicate|X|120', 'מפתח הממצא: חודש, סוג, בית עסק, סכום (רק בטלפון, ל־hash)');

  // ---------------------------------------------------------------- 5. מחרוזות
  const keys = new Set([...(mod + boot).matchAll(/'(cf[A-Z]\w*)'/g)].map((m) => m[1]));
  const miss = [...keys].filter((k) => !STR.he[k] || !STR.en[k]);
  ok(keys.size > 100 && !miss.length, 'כל מפתח cf בעברית ובאנגלית' + (miss.length ? ': ' + miss.join(', ') : ''));
  ok(STR.he.loginSubCashflow && STR.en.loginSubCashflow, 'מסך הכניסה — בעברית ובאנגלית');
  const css = read('cashflow.css');
  ok(!/border-radius:\s*\d+px/.test(css) && !/(margin|padding)-(left|right)|text-align:\s*(left|right)/.test(css), 'cashflow.css: עיגולים רק במשתנים, יישור רק לוגי');
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
