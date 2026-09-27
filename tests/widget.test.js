// widget.test.js — v211: ווידג'ט למסך הבית (/api/widget). לוח המסחר זהה לאפליקציה, מודל הטקסטים, פרמטרי
// הקישור, הכותרת בשורה/שתיים בכל החגים, ה־HTML (escape, לוגו 84px) והקישור שהאפליקציה יוצרת.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const libSrc = fs.readFileSync(path.join(root, 'ibkr-proxy/lib/market.js'), 'utf8');
const fnText = (src, name) => { const i = src.indexOf('\nfunction ' + name + '('); return i < 0 ? null : src.slice(i + 1, src.indexOf('\n}\n', i) + 2); };
for (const f of ['easterSunday', 'nyseHolidays', 'etDateParts', 'marketClosedReason', 'ilDateParts', 'taseHolidayKey', 'taseMarketNow']) {
  ok(fnText(app, f) && fnText(app, f) === fnText(libSrc, f), 'lib/market.js: ' + f + ' זהה לאפליקציה (שינוי ב־app.js → לעדכן גם כאן)');
}
const market = require('../ibkr-proxy/lib/market');
const M = require('../ibkr-proxy/lib/widget-model');
const { buildHtml, LOGO } = require('../ibkr-proxy/lib/widget-html');

// פרמטר s
const items = M.parseItems('aapl~i~Apple,LUMI.TA~m~לאומי~leumi,TSLA~w~Tesla,bad sym~i,AAPL~m~dup,X<Y~i,OXY~m~<b>Occ</b>~../x');
ok(items.length === 4 && items[0].sym === 'AAPL' && items[0].src === 'ibkr' && items[1].logo === 'leumi' && items[2].src === 'watch', 'parseItems: סימבול/מקור/שם/לוגו, כפילות וסימבול לא חוקי נזרקים');
ok(items[3].name === 'bOcc/b' && items[3].logo === '', 'parseItems: שם מנוקה מ־<>, מזהה לוגו לא חוקי נזרק');
ok(M.parseItems(Array.from({ length: 40 }, (_, i) => 'S' + i + '~i').join(','), 30).length === 30, 'parseItems: עד 30');
ok(/MAX_ITEMS = 30/.test(fs.readFileSync(path.join(root, 'ibkr-proxy/api/widget.js'), 'utf8')) && !/id="widgetN"/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')), 'v212: עד 30 מניות בשרתון, אין בורר כמות בהגדרות');

// ציטוט: META 25/9 אחרי־מסחר (מבנה /api/quotes) — כמו Yahoo: −25.93 (−3.33%), אחרי־מסחר −0.51%
const T0 = 1790366401, TP = 1790380799;
const ctp = { pre: { start: 1790323200, end: 1790343000 }, regular: { start: 1790343000, end: 1790366400 }, post: { start: 1790366400, end: 1790380800 } };
const meta = { currency: 'USD', symbol: 'META', regularMarketPrice: 751.66, previousClose: 777.59, regularMarketTime: T0, currentTradingPeriod: ctp, longName: 'Meta Platforms, Inc.' };
const chart = { chart: { result: [{ meta, timestamp: [TP], indicators: { quote: [{ close: [747.82] }] } }] } };
const sat = Date.parse('2026-09-26T12:00:00Z');
let q = M.parseQuote(chart, sat);
ok(Math.abs(q.regCh + 25.93) < 1e-6 && Math.abs(q.regPct + 3.3347) < 1e-3 && q.ext.kind === 'post' && Math.abs(q.ext.pct + 0.5109) < 1e-3 && q.session === 'closed', 'parseQuote בלי v7: שינוי רשמי + אחרי־מסחר + סגור');
q = M.parseQuote(Object.assign({}, chart, { x: { state: 'CLOSED', reg: { p: 751.66, ch: -25.9301, pct: -3.33467 }, post: { p: 747.82, ch: -3.84, pct: -0.51086 } } }), sat);
ok(q.regPct === -3.33467 && q.ext.pct === -0.51086, 'parseQuote עם v7: המספרים של Yahoo');
// ת״א באגורות + חג: Yahoo מחזיר 0 → מהסגירות היומיות (בלי יום בלי מסחר)
const ta = { chart: { result: [{ meta: { currency: 'ILA', symbol: 'LUMI.TA', regularMarketPrice: 7588, previousClose: 7588, regularMarketTime: 1790260020 }, timestamp: [1790260020], indicators: { quote: [{ close: [7588] }] } }] } };
const qa = M.parseQuote(ta, sat);
ok(qa.price === 75.88 && qa.regCh === 0 && qa.ext === null, 'ת״א: אגורות → שקלים, בלי מסחר מורחב');
const d = M.dayChange(qa, [76.89, 75.88]);
ok(Math.abs(d.ch + 1.01) < 1e-9 && Math.abs(d.pct + 1.3136) < 1e-3, 'ת״א בחג: השינוי של יום המסחר האחרון (לא 0.00%)');

// מודל מלא
const m = M.buildModel(M.parseItems('META~i~Meta Platforms,LUMI.TA~m~לאומי~leumi,TSLA~w~Tesla'), { META: chart, 'LUMI.TA': ta }, { 'LUMI.TA': [76.89, 75.88] }, { lang: 'he', nowMs: sat });
const c0 = m.cards[0], c1 = m.cards[1], c2 = m.cards[2];
ok(c0.price === '\u2066$747.82\u2069' && c0.chg === '\u2066\u2212$25.93\u2069 (\u2066\u22123.33%\u2069)' && c0.dir === 'neg', 'כרטיס: מחיר חי + צ׳יפ "‎−$25.93 (−3.33%)"');
ok(c0.sub === 'אחרי־מסחר' && c0.subPct === '\u2066\u22120.51%\u2069' && c0.subDir === 'neg', 'כרטיס: שורת אחרי־מסחר');
ok(c1.price === '\u20677,588 אג׳\u2069' && c1.chg.startsWith('\u2066\u2212101 אג׳\u2069') && c1.sub === 'סגור · סוכות', 'ת״א: "7,588 אג׳", "−101 אג׳", "סגור · סוכות" (שבת בסוכות — החג קודם)');
ok(c2.price === '—' && c2.chg === '', 'בלי ציטוט: מקף, בלי צ׳יפ');
ok(c0.logo === 'https://financialmodelingprep.com/image-stock/META.png' && c1.logo === 'https://s3-symbol-logo.tradingview.com/leumi.svg', 'לוגו: FMP / TradingView (כמו באפליקציה)');
ok(m.header.lines.join('') === 'השוק סגור ·סופ״ש' && m.header.two === false && /^עודכן \d\d:\d\d$/.test(m.updated), 'כותרת: "השוק סגור · סופ״ש" בשורה אחת + שעת עדכון');
const en = M.buildModel(M.parseItems('META~i'), { META: chart }, {}, { lang: 'en', nowMs: sat });
ok(en.header.lines[0] === 'Closed' && en.header.lines[1] === 'Weekend' && en.header.two === true && en.dir === 'ltr' && en.cards[0].name === 'Meta Platforms, Inc.', 'אנגלית: "Closed / Weekend" בשתי שורות, LTR, שם מ־Yahoo כשאין מהאפליקציה');

// כל חגי NYSE: עם סיבה → שתי שורות (הבועה לא נוגעת בלוגו — נמדד בתצוגה המקדימה), סופ״ש בשורה אחת
const regNow = { META: { chart: { result: [{ meta: Object.assign({}, meta, { currentTradingPeriod: {} }), timestamp: [], indicators: { quote: [{ close: [] }] } }] }, x: { state: 'CLOSED' } } };
for (const [iso, key] of [['2026-01-01T15:00:00Z', 'hdNewYear'], ['2026-01-19T15:00:00Z', 'hdMlk'], ['2026-04-03T15:00:00Z', 'hdGoodFriday'], ['2026-05-25T15:00:00Z', 'hdMemorial'], ['2026-06-19T15:00:00Z', 'hdJuneteenth'], ['2026-07-03T15:00:00Z', 'hdIndependence'], ['2026-09-07T15:00:00Z', 'hdLabor'], ['2026-11-26T15:00:00Z', 'hdThanksgiving'], ['2026-12-25T15:00:00Z', 'hdChristmas']]) {
  const mm = M.buildModel(M.parseItems('META~i'), regNow, {}, { lang: 'he', nowMs: Date.parse(iso) });
  ok(market.marketClosedReason(Date.parse(iso)) === key && mm.header.two === true && mm.header.lines[0] === 'השוק סגור' && mm.header.lines[1] === M.STR.he[key], 'כותרת בחג ' + key + ': שתי שורות, בלי "·"');
}
const open = M.buildModel(M.parseItems('META~i'), { META: Object.assign({}, chart, { x: { state: 'REGULAR', reg: { p: 751, ch: 1, pct: 0.1 } } }) }, {}, { lang: 'he', nowMs: sat });
ok(open.header.lines[0] === 'המסחר פתוח' && open.header.live === true && open.cards[0].sub === '', 'שוק פתוח: "המסחר פתוח" עם נקודה חיה, בלי שורת מסחר מורחב');

// HTML
const html = buildHtml(Object.assign({}, m, { cards: [Object.assign({}, c0, { name: '<img src=x onerror=alert(1)>' })] }), { theme: 'light', n: 3 });
ok(!html.includes('<img src=x') && html.includes('&lt;img src=x'), 'HTML: טקסט עובר escape');
ok(LOGO === 84 && html.includes('width:84px;height:84px') && html.includes('class="hero"') && html.includes('<body class="light"'), 'HTML: לוגו 84px במרכז העליון, ערכה בהירה');
ok(/data:image\/png;base64,/.test(html) && !/github\.io/.test(html), 'HTML: הלוגו וסמל IBKR מוטמעים (בלי רשת)');

// Vercel
const vj = JSON.parse(fs.readFileSync(path.join(root, 'ibkr-proxy/vercel.json'), 'utf8'));
ok(vj.functions['api/widget.js'] && /assets/.test(vj.functions['api/widget.js'].includeFiles) && /chromium\/bin/.test(vj.functions['api/widget.js'].includeFiles), 'vercel.json: widget עם הנכסים וקבצי Chromium');
const pj = JSON.parse(fs.readFileSync(path.join(root, 'ibkr-proxy/package.json'), 'utf8'));
ok(/^\d/.test(pj.dependencies['@sparticuz/chromium']) && /^\d/.test(pj.dependencies['puppeteer-core']), 'package.json: גרסאות מקובעות');
ok(fs.readFileSync(path.join(root, 'ibkr-proxy/.gitignore'), 'utf8').includes('node_modules'), 'node_modules לא נכנס לגיט');


// ---- האפליקציה: רשימה, קישור וקובץ .kwgt ----
const sb = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, style: {} }) }, window: {}, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(new Error('x')), setTimeout, clearTimeout, console, Image: class { set src(_) {} } };
sb.TextEncoder = TextEncoder; sb.location = { origin: 'https://yishaiguedj1.github.io', pathname: '/portfolio-pwa/index.html' };
vm.createContext(sb); vm.runInContext(app, sb);
const R = (c) => vm.runInContext(c, sb);
R("POSITIONS.length = 0; POSITIONS.push({ sym: 'KO', name: 'Coca-Cola', shares: 10, avg: 50, src: 'manual' }, { sym: 'AAPL', name: 'Apple', shares: 10, avg: 100 }, { sym: 'LUMI.TA', name: 'לאומי', shares: 100, avg: 30, src: 'manual' }, { sym: 'ZERO', shares: 0, avg: 1 });" +
  "WISHLIST.length = 0; WISHLIST.push({ sym: 'TSLA' }, { sym: 'KO' });" +
  "state.quotes = { KO: { close: 87 }, AAPL: { close: 341 }, 'LUMI.TA': { close: 75.88 } }; state.fx = 3.05; state.lang = 'he';");
const wi = R('widgetItems()');
ok(wi.map((x) => x.sym).join(',') === 'AAPL,LUMI.TA,KO', 'רשימה (v212): כל האחזקות לפי שווי — בלי רשימת המעקב ובלי כמות 0');
ok(wi[1].logo === 'leumi' && wi[2].src === 'm' && !wi.some((x) => x.src === 'w'), 'רשימה: מזהה לוגו ת״א, תגית ידני, אין פריטי מעקב');
const param = R('widgetParam(widgetItems())');
ok(/^AAPL~[im]~Apple,LUMI\.TA~m~לאומי~leumi,KO~m~Coca-Cola$/.test(param) && !/\d{2,}~/.test(param), 'קישור: סימבול~מקור~שם — בלי כמויות/שווי');
ok(M.parseItems(param).length === 3, 'השרתון מפענח את מה שהאפליקציה יוצרת');
const url = R("widgetUrl({ theme: 'dark' })");
ok(url.startsWith('https://ibkr-proxy-wine.vercel.app/api/widget?s=') && url.endsWith('&l=he&t=dark') && !/&n=/.test(url), 'קישור מלא לשרתון, בלי כמות (כל התיק)');
const preset = R("widgetPreset('https://x/api/widget?s=A', [{ sym: 'AAPL' }, { sym: 'LUMI.TA' }, { sym: 'KO' }])");
const bm = preset.preset_root.viewgroup_items[0];
ok(preset.preset_root.internal_type === 'RootLayerModule' && bm.internal_type === 'BitmapModule' && bm.internal_formulas.bitmap_bitmap === '$gv(link)$&z=$df(HHmm)$' && preset.preset_root.globals_list.link.value === 'https://x/api/widget?s=A', 'preset.json: תמונה מהקישור (משתנה link), מתרעננת כל דקה');
ok(/^intent:https:\/\/yishaiguedj1\.github\.io\/portfolio-pwa\/#Intent;action=android\.intent\.action\.VIEW;/.test(bm.internal_events[0].intent), 'נגיעה בכותרת פותחת את האפליקציה');
// v213: אזור נגיעה לכל כרטיס — על הכרטיס בדיוק (אותה גיאומטריה כמו השרתון) ופותח את המניה
const H = require('../ibkr-proxy/lib/widget-html');
const G = R('WIDGET_GEOM');
ok(G.W === H.WIDTH && G.HEAD === H.HEAD && G.CARD === H.CARD && G.GAP === H.GAP && G.TOP0 === H.TOP0 && G.BOTTOM === H.BOTTOM, 'גיאומטריה זהה באפליקציה ובשרתון');
const zones = preset.preset_root.viewgroup_items.slice(1);
const k = 720 / 400, hCss = H.TOP0 + 3 * H.CARD + 2 * H.GAP + H.BOTTOM;
ok(zones.length === 3 && zones.every((z) => z.internal_type === 'ShapeModule' && z.paint_color === '#00FFFFFF'), 'שלושה אזורי נגיעה שקופים');
ok(zones.every((z, i) => Math.abs(z.position_offset_y - (H.TOP0 + i * (H.CARD + H.GAP) + H.CARD / 2 - hCss / 2) * k) <= 1 && Math.abs(z.shape_height - H.CARD * k) <= 1) && preset.preset_info.height === Math.round(hCss * k), 'אזור i ממורכז על כרטיס i (ביחידות KWGT)');
ok(/#stock=LUMI\.TA#Intent;action=android\.intent\.action\.VIEW;/.test(zones[1].internal_events[0].intent), 'נגיעה בכרטיס → #stock=SYM');
// קישור עמוק באפליקציה
R("var __sw = null, __opened = []; switchTab = (n) => { __sw = n; }; toggleStock = (s) => { __opened.push(s); state.open[s] = true; }; globalThis.history = { replaceState: () => { location.hash = ''; } };");
R("location.hash = '#stock=LUMI.TA'; document.querySelector = (q) => (/data-sym=\"LUMI\.TA\"/.test(q) ? { getBoundingClientRect: () => ({ top: 500, height: 50 }) } : null); window.scrollTo = () => {}; window.scrollY = 0;");
ok(R('openStockFromHash()') === true && R('__sw') === 'stocks' && R('__opened.join()') === 'LUMI.TA' && R('location.hash') === '', '#stock=SYM → טאב מניות, הכרטיס נפתח, ה־hash נמחק');
R("location.hash = '#stock=NOPE'; __sw = null;");
ok(R('__sw') === null && (R('openStockFromHash()'), R('__sw')) === null, 'מניה שלא בתיק — לא עוברים טאב (v214: מחכים עד 8 שניות לטעינת התיק)');
// v214: ווידג'ט אפליקציית האנדרואיד — חתימה זהה ל־Java String.hashCode, ‎#app= מזהה את האפליקציה, שליחת רשימה ב־intent
ok(R("javaHash36('hello')") === (99162322).toString(36) && R("javaHash36('')") === '0' && R("javaHash36('AAPL~i~Apple|he')") === ((() => { let h = 0; for (const ch of 'AAPL~i~Apple|he') h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0; return (h >>> 0).toString(36); })()), 'חתימה = String.hashCode של Java (בסיס 36, בלי סימן)');
R("globalThis.__ss = {}; globalThis.sessionStorage = { getItem: (k) => (k in __ss ? __ss[k] : null), setItem: (k, v) => { __ss[k] = String(v); } };");
R("location.hash = ''; location.href = '';");
ok(R('inAndroidApp()') === false && R('appWidgetSync(true)') === false && R('location.href') === '', 'בדפדפן רגיל (בלי ‎#app=) — לא שולחים intent');
R("location.hash = '#app=0'; appSessionFromHash();");
ok(R('inAndroidApp()') === true && R('location.hash') === '', '‎#app= מזהה את האפליקציה ונמחק מהכתובת');
ok(R('appWidgetSync(false)') === true && /^intent:\/\/widget\?s=AAPL~[im]~Apple%2CLUMI\.TA~m~.+&l=he#Intent;scheme=snowball;package=io\.github\.yishaiguedj1\.snowball;end$/.test(R('location.href')), 'רשימה שונה מהווידג׳ט → intent עם הרשימה (בלי כמויות)');
R("location.href = '';");
ok(R('appWidgetSync(false)') === false && R('location.href') === '', 'אחרי שליחה — לא שולחים שוב עד שהתיק משתנה');
ok(R('appWidgetSync(true)') === true, 'כפתור "סנכרון לווידג׳ט" שולח תמיד');
// zip אמיתי — נפתח ב־unzip
const zipBytes = R("zipStore([{ name: 'preset.json', data: new TextEncoder().encode(JSON.stringify(widgetPreset('https://x/?s=A', [{ sym: 'AAPL' }]))) }, { name: 'preset_thumb_portrait.jpg', data: new Uint8Array([137, 80, 78, 71]) }])");
const tmp = path.join(require('os').tmpdir(), 'w' + process.pid + '.kwgt');
fs.writeFileSync(tmp, Buffer.from(zipBytes));
let unz = '';
try { unz = require('child_process').execFileSync('python3', ['-c', 'import zipfile,sys,json;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(json.loads(z.read("preset.json"))["preset_info"]["title"], len(z.namelist()))', tmp]).toString().trim(); } catch (e) { unz = 'ERR ' + e.message; }
fs.unlinkSync(tmp);
ok(unz === 'THE SNOWBALL 2', '.kwgt: zip תקין (CRC) עם preset.json + תמונה ממוזערת');
ok(/id="widgetCard"/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')) && R("tabRenderer('settings') === renderSettingsLive"), 'כרטיס בהגדרות, מצויר כשהטאב נראה');

console.log('\n' + n + ' בדיקות עברו');
