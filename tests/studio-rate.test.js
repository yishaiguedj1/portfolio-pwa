// 25/10/2026: המשוב שלך על התרגום (לפי התצוגה המקדימה שאושרה) — 👍/👎, "מה לא היה טוב?", סימון כתובית בנגן.
// 1. RATE_WHY / RATE_FLAG_MAX / normRate זהים בטלפון ובשרתון. 2. flagCue — הכתובית שעל המסך, או זו שהסתיימה עד 2 שנ׳ לפני.
// 3. החיבורים בדף העבודה ובנגן. הרצה: node tests/studio-rate.test.js  (השרתון עצמו — בלוק 7 ב־studio-url.test.js)
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const st = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
const pl = fs.readFileSync(path.join(root, 'studioplay.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'studio.css'), 'utf8');
const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));

/* 1 */
const arr = (re) => JSON.parse(st.match(re)[1].replace(/'/g, '"'));
ok(JSON.stringify(arr(/export const RATE_WHY = (\[[^\]]*\])/)) === JSON.stringify(S.RATE_WHY), 'RATE_WHY זהה בטלפון ובשרתון');
ok(+st.match(/export const RATE_FLAG_MAX = (\d+)/)[1] === S.RATE_FLAG_MAX, 'RATE_FLAG_MAX זהה');
const grab = (src, name) => { const a = src.indexOf('export function ' + name + '('); return src.slice(a, src.indexOf('\n}\n', a) + 2).replace(/^export /, ''); };
// eslint-disable-next-line no-new-func
const phoneNorm = new Function('RATE_WHY', 'RATE_FLAG_MAX', grab(st, 'normRate') + 'return normRate;')(S.RATE_WHY, S.RATE_FLAG_MAX);
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (a) => a[Math.floor(rnd() * a.length)];
let same = true;
for (let i = 0; i < 400; i++) {
  const o = rnd() < 0.05 ? pick([null, 1, 'x', []]) : {
    r: pick([1, -1, 0, 2, '1', undefined]), w: rnd() < 0.8 ? Array.from({ length: Math.floor(rnd() * 5) }, () => pick(S.RATE_WHY.concat(['zz', 3]))) : 'acc',
    c: rnd() < 0.8 ? Array.from({ length: Math.floor(rnd() * 70) }, () => pick([Math.floor(rnd() * 900), -1, 2.5, '4', 1e7])) : undefined, at: pick([0, 123, -5, 'x', 1.9]),
  };
  if (JSON.stringify(phoneNorm(o)) !== JSON.stringify(S.normRate(o))) { same = false; console.error(JSON.stringify(o)); break; }
}
ok(same, 'normRate זהה בטלפון ובשרתון (400 קלטים אקראיים)');
ok(S.normRate({ r: 1, w: ['acc'] }).w === undefined && S.normRate({ r: 0 }) === null && S.normRate({ c: [5] }).r === 0, 'סיבות רק עם 👎; בלי דירוג ובלי סימונים — כלום; סימונים בלי דירוג — נשמרים');
ok(S.JSON_FIELDS ? S.JSON_FIELDS.includes('urt') : /'urt'\]/.test(fs.readFileSync(path.join(root, 'ibkr-proxy/lib/studio.js'), 'utf8')), 'urt = שדה JSON במסמך העבודה');

/* 2 */
// eslint-disable-next-line no-new-func
const P = new Function(grab(pl, 'cueAt') + grab(pl, 'flagCue') + 'return { flagCue };')();
const cues = [{ i: 1, s: 1, e: 3 }, { i: 2, s: 5, e: 7 }, { i: 9, s: 20, e: 22 }];
ok(P.flagCue(cues, 2) === 0 && P.flagCue(cues, 6.5) === 1, 'הכתובית שעל המסך');
ok(P.flagCue(cues, 8.5) === 1 && P.flagCue(cues, 9.5) === -1 && P.flagCue(cues, 0.5) === -1, 'ברווח — זו שהסתיימה עד 2 שנ׳ לפני; אחרת אין');

/* 3 */
ok(/if \(rateOk\(rec\)\) p\.append\(rateCard\(rec\)\)/.test(st), 'דף העבודה: "איך יצא התרגום?" אחרי התוצרים');
ok(/rateSend\(rec, \{ r: -1 \}\)\.then\(\(ok\) => \{ if \(ok\) rateSheet\(rec\); \}\)/.test(st), '👎 נשמר מיד, ואז הגיליון "מה לא היה טוב?"');
ok((st.match(/\.\.\.rateFlagOpts\(rec\)/g) || []).length === 2, 'הדגל בשני הנגנים של דף הצפייה (קובץ מהטלפון / מהענן)');
ok(/if \(rsClose\(\)\) \{ if \(root\) watch\(\); return; \}/.test(st) && /if \(kind !== 'none'\) rsClose\(\)/.test(st), '"חזור" סוגר את הגיליון; מעבר דף — הגיליון לא נשאר');
ok(/const flagB = opts\.onFlag \?/.test(pl) && /paintFlags\(\)/.test(pl) && /studioPlFlagUndo/.test(pl), 'הנגן: דגל רק כשהדף ביקש, סימן בפס, "ביטול"');
ok(/\.st-pl-flags i \{[^}]*#FFD60A/.test(css) && /\.st-rs-chip\.on \{[^}]*var\(--primary\)/.test(css), 'עיצוב: סימן צהוב בפס, בחירה במבטא של Studio');
ok(!/net\.api\('rate'[^)]*\b(lines|en|text|name)\b/.test(st), 'לשרתון רק קודים ומספרים — בלי טקסט');

console.log('\nכל ' + n + ' הבדיקות עברו ✓');
