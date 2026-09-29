// gain-v256.test.js — גרף "רווח/הפסד מהקנייה" בסקירה: סקאלה, שורות, לוגואים אופקיים (Wikidata → Commons דרך השרתון)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const sb = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, style: {} }) }, window: {}, navigator: {}, location: { origin: 'https://yishaiguedj1.github.io', pathname: '/portfolio-pwa/' }, AbortController, fetch: () => Promise.reject(new Error('x')), setTimeout, clearTimeout, console, TextEncoder, Image: class { set src(_) {} } };
vm.createContext(sb); vm.runInContext(app, sb);
const R = (c) => vm.runInContext(c, sb);
let s = R('gainScale([45.3, 44.9, -37.6, -0.9])');
ok(s.lo < -37.6 && s.lo > -42 && s.hi > 45.3 && s.hi < 49 && s.ticks.join() === '-25,0,25', 'v258: הציר = טווח הנתונים (+3%), לא מעוגל ל־±50; קווי רשת עגולים בפנים');
s = R('gainScale([12, 3])');
ok(s.lo === 0 && s.hi > 12 && s.ticks[0] === 0 && s.x(0) === 0, 'רק רווחים — האפס בקצה');
s = R('gainScale([250, -45])');
ok(s.ticks.length <= 4 && s.lo <= -45 && s.hi >= 250 && s.ticks.includes(0), 'טווח רחב — עד 4 קווים, 0 תמיד');
ok(R('gainScale([0]).hi') > 0, 'הכל 0 — לא מתחלק באפס');
ok(R('gainUsesMark(20)') && R('gainUsesMark(-20)') && R('gainUsesMark(45.3)') && !R('gainUsesMark(19.9)') && !R('gainUsesMark(-19.99)'), 'v258: חוק ה־20% — מ־20% (רווח או הפסד) פס עם לוגו, מתחת — לוגו רגיל');
const fit = app.slice(app.indexOf('function gainBarsFit('), app.indexOf('function row0('));
ok(/const bw = Math\.abs\(row\._xe - row\._x0\) \/ 100 \* W;/.test(fit) && !/Math\.max\(bw/.test(fit) && !/gainMinTile/.test(app), 'v258: אורך הפס = האחוז תמיד — בלי מתיחה/קיצוץ');
ok(/ico\.style\.right = \(W - x0 \+ 8\)/.test(fit) && /ico\.style\.left = \(x0 \+ 8\)/.test(fit), 'v258: לוגו רגיל בצד השני של קו האפס');
const rows = R("gainRows([{ sym: 'A', shares: 10, avg: 100 }, { sym: 'B', shares: 5, avg: 50 }, { sym: 'C', shares: 0, avg: 10 }, { sym: 'D', shares: 3, avg: 0 }, { sym: 'E', shares: 1, avg: 10 }], (s) => ({ A: 150, B: 40, C: 20, D: 5 })[s] || null)");
ok(rows.map((r) => r.sym).join() === 'A,B' && Math.abs(rows[0].g - 50) < 1e-9 && Math.abs(rows[1].g + 20) < 1e-9, 'שורות: רק אחזקה עם מחיר ועלות, מהגבוהה לנמוכה');
ok(R('gainPctTxt(44.94)') === R("ltrNum('+44.9%')") && R('gainPctTxt(-0.7)') === R("ltrNum('−0.7%')"), 'אחוז בספרה אחת, מינוס אמיתי, בידוד LTR');
R("_wm = { ADBE: { at: Date.now(), v: { url: 'https://thumb.wikimedia.org/x.png', w: 500, h: 126 } }, AAPL: { at: Date.now(), v: { url: 'https://thumb.wikimedia.org/a.png', w: 500, h: 614 } } };");
ok(R("wordmarkOf('ADBE').w") === 500 && R("wordmarkOf('AAPL')") === null && R("wordmarkOf('ZZZ')") === null, 'לוגו אופקי רק ברוחב ≥1.8 מהגובה (Apple הריבועי — לוגו מורכב)');
ok(/class="gb-mark"/.test(R("gainMarkHTML('ADBE', 'Adobe')")) && /gb-fb/.test(R("gainMarkHTML('AAPL', 'Apple Inc.')")) && /Apple</.test(R("gainMarkHTML('AAPL', 'Apple Inc.')")), 'בלי לוגו אופקי: אייקון + שם בלי "Inc."');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(/id="gainCard"/.test(html) && /id="gainBars" dir="ltr"/.test(html) && /img-src[^;]*https:\/\/thumb\.wikimedia\.org/.test(html) && /img-src[^;]*https:\/\/upload\.wikimedia\.org/.test(html), 'כרטיס בסקירה + CSP מאפשר תמונות מ־Wikimedia');
ok(/'thumb\.wikimedia\.org'/.test(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')), 'SW שומר את הלוגואים במטמון ריצה');
ok(/gainSetActive\(box, box\._active === b\.dataset\.sym \? null : b\.dataset\.sym\)/.test(app) && !/openStockCard\(b\.dataset\.sym/.test(app), 'נגיעה = הרמה כמו בעוגה (לא מעבר לכרטיס)');
ok(/try \{ renderGainBars\(\); \} catch/.test(app) && /pct\.textContent !== txt/.test(app), 'מצויר עם הסקירה (רק כשהטאב נראה) ומתעדכן במקום בטיק החי');
// השרתון
const W = require('../ibkr-proxy/lib/wordmark');
ok(W.tickerOf('BRK-B').ticker === 'BRK.B' && W.tickerOf('LUMI.TA').ticker === 'LUMI' && W.tickerOf('LUMI.TA').ex[0] === W.EX_TA && W.tickerOf('^GSPC') === null && W.tickerOf('A"B') === null, 'סימבול → טיקר ובורסה (בלי מדדים, בלי תווים זרים)');
ok(/VALUES \?t \{ "ADBE" "LUMI" \}/.test(W.sparqlFor(['ADBE', 'LUMI.TA'])) && /wdt:P154/.test(W.sparqlFor(['ADBE'])) && W.sparqlFor(['^GSPC']) === null, 'שאילתת SPARQL');
const B = [{ t: { value: 'POLI' }, ex: { value: 'http://www.wikidata.org/entity/Q1507974' }, logo: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Bank%20happoalim%202018%20logo.svg' } },
  { t: { value: 'POLI' }, ex: { value: 'http://www.wikidata.org/entity/Q999' }, logo: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Wrong.svg' } },
  { t: { value: 'NOW' }, ex: { value: 'http://www.wikidata.org/entity/Q13677' }, logo: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/ServiceNow_logo.svg' } }];
const f = W.pickFiles(['POLI.TA', 'NOW', 'X'], B);
ok(f['POLI.TA'] === 'Bank happoalim 2018 logo.svg' && f.NOW === 'ServiceNow logo.svg' && !f.X, 'רק מהבורסה של הסימבול (הפועלים בת"א, לא באינדונזיה)');
const th = W.pickThumbs({ query: { pages: { 1: { title: 'File:ServiceNow logo.svg', imageinfo: [{ thumburl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/ServiceNow_logo.svg/500px-ServiceNow_logo.svg.png?utm_source=x', thumbwidth: 480, thumbheight: 70 }] }, 2: { title: 'File:Evil.svg', imageinfo: [{ thumburl: 'https://evil.example/x.png', thumbwidth: 1, thumbheight: 1 }] } } } });
ok(th['ServiceNow logo.svg'].url.endsWith('.png') && !/\?/.test(th['ServiceNow logo.svg'].url) && !th['Evil.svg'], 'תמונה ממוזערת בלי פרמטרי מעקב, רק מ־Wikimedia');
ok(W.pickFiles(['UNH'], [])['UNH'] === 'UnitedHealthcare (logo).svg', 'UNH: הלוגו הקומפקטי (עם ה־U) במקום הרשמי הדק');
const vj = JSON.parse(fs.readFileSync(path.join(root, 'ibkr-proxy/vercel.json'), 'utf8'));
ok(vj.functions['api/wordmark.js'], 'vercel.json: נקודה חדשה רשומה');
console.log('\n' + n + ' בדיקות עברו');
