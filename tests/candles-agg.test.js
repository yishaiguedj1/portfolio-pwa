// 17/11/2026 — בדיקת העומק של גרף הנרות, גל 6 (docs/chart-deep-audit.md): שבועי/חודשי מהיומי בשרתון
// (C-003, ‏C-013, ‏C-019, ‏C-020, ‏C-023, ‏C-027) וסוף החודש הקלנדרי בטלפון (החלק החודשי של C-025/C-026).
// מול ערכים שחושבו ביד, עם Yahoo מדומה (בלי רשת). הרצה: node tests/candles-agg.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let n = 0;
const ok = (c, name) => { n++; assert(c, name); console.log('ok -', name); };
const root = path.join(__dirname, '..');
const C = require(path.join(root, 'ibkr-proxy/lib/candles.js'));
const U = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi) / 1000;
const cols = (rows) => ({ t: rows.map((r) => r[0]), o: rows.map((r) => r[1]), h: rows.map((r) => r[2]), l: rows.map((r) => r[3]), c: rows.map((r) => r[4]), v: rows.map((r) => r[5]) });
const yj = (tz, rows, cur = 'USD') => ({ chart: { result: [{ meta: { currency: cur, exchangeTimezoneName: tz, exchangeName: 'X', longName: 'Test' },
  timestamp: rows.map((r) => r[0]), indicators: { quote: [{ open: rows.map((r) => r[1]), high: rows.map((r) => r[2]), low: rows.map((r) => r[3]), close: rows.map((r) => r[4]), volume: rows.map((r) => r[5]) }] } }] } });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------- הצבירה (טהורה) ---------- */
// ניו יורק, מניה (09:30): שבוע שני–ראשון, 1 לחודש, חצות מקומית — גם מעבר שעון (1/11/2026) וגם מעבר חודש באמצע שבוע
const NY = Object.assign(cols([
  [U(2026, 10, 26, 13, 30), 10, 12, 9, 11, 100], [U(2026, 10, 27, 13, 30), 11, 13, 10, 12, 200], [U(2026, 10, 30, 13, 30), 12, 15, 11, 14, 300],
  [U(2026, 11, 2, 14, 30), 14, 14.5, 8, 9, 400], [U(2026, 11, 6, 14, 30), 9, 10, 8.5, 9.5, 500],
]), { tz: 'America/New_York', cur: 'USD', ex: 'NMS', name: 'Test' });
const w = C._aggregate(NY, '1wk'), m = C._aggregate(NY, '1mo');
ok(same(w.t, [U(2026, 10, 26, 4), U(2026, 11, 2, 5)]), 'שבועי: תווית = שני 00:00 בשעון ניו יורק (קיץ 04:00Z, חורף 05:00Z)');
ok(same([w.o[0], w.h[0], w.l[0], w.c[0], w.v[0]], [10, 15, 9, 14, 600]) && same([w.o[1], w.h[1], w.l[1], w.c[1], w.v[1]], [14, 14.5, 8, 9.5, 900]), 'שבועי: פתיחה של הראשון, קיצון, סגירה של האחרון, סכום נפח');
ok(same(m.t, [U(2026, 10, 1, 4), U(2026, 11, 1, 4)]) && same([m.o[1], m.h[1], m.l[1], m.c[1], m.v[1]], [14, 14.5, 8, 9.5, 900]), 'חודשי: 1 לחודש 00:00 מקומי (1/11/2026 — עוד שעון קיץ, 04:00Z), בלי שורה כפולה (C-003)');
ok(w.tz === 'America/New_York' && w.iv === '1wk' && m.iv === '1mo' && w.name === 'Test', 'הצבירה שומרת אזור זמן, מטבע ושם');
// מלפני 1970: היומי מתחיל בשישי 2/1/1970 — השבוע של 29/12/1969 (תווית שלילית) מתויג בחצות היום הראשון
const old = Object.assign(cols([[U(1970, 1, 2, 14, 30), 92, 93, 91, 93, 8e6], [U(1970, 1, 5, 14, 30), 93, 94, 92, 93.5, 1e7]]), { tz: 'America/New_York' });
const ow = C._aggregate(old, '1wk');
ok(same(ow.t, [U(1970, 1, 2, 5), U(1970, 1, 5, 5)]) && ow.t.every((t) => t > 0), 'שבוע ראשון לפני 1970 — חצות היום הראשון, לא תווית שלילית (C-013)');
ok(same(C._aggregate(old, '1mo').t, [U(1970, 1, 1, 5)]), 'חודש ראשון: 1/1/1970 00:00 ניו יורק');
// UTC (קריפטו): שבת וראשון שייכים לשבוע שהתחיל בשני הקודם
const btc = Object.assign(cols([[U(2026, 11, 14), 1, 2, 1, 2, 1], [U(2026, 11, 15), 2, 3, 2, 3, 1], [U(2026, 11, 16), 3, 4, 3, 4, 1]]), { tz: 'UTC' });
ok(same(C._aggregate(btc, '1wk').t, [U(2026, 11, 9), U(2026, 11, 16)]), 'UTC: שבת–ראשון בשבוע של שני הקודם, שני פותח שבוע');
// שיקגו (‎^VIX, נרות ב־08:00Z): תווית שני 00:00 שעון שיקגו לפני ואחרי מעבר לשעון קיץ (8/3/2026)
const vix = Object.assign(cols([[U(2026, 3, 6, 8), 20, 21, 19, 20, 0], [U(2026, 3, 9, 8), 20, 22, 19, 21, 0]]), { tz: 'America/Chicago' });
ok(same(C._aggregate(vix, '1wk').t, [U(2026, 3, 2, 6), U(2026, 3, 9, 5)]), 'שיקגו: שני 00:00 (חורף 06:00Z, קיץ 05:00Z)');
// חוזים (נר יומי = 00:00 ניו יורק של יום המסחר)
const es = Object.assign(cols([[U(2026, 10, 30, 4), 1, 2, 1, 2, 5], [U(2026, 11, 2, 5), 2, 3, 2, 3, 6]]), { tz: 'America/New_York' });
ok(same(C._aggregate(es, '1wk').t, [U(2026, 10, 26, 4), U(2026, 11, 2, 5)]) && same(C._aggregate(es, '1mo').t, [U(2026, 10, 1, 4), U(2026, 11, 1, 4)]), 'חוזים: חצות של יום המסחר נספרת ליום הנכון');
ok(C._pstart(U(2026, 3, 1, 15), 'America/New_York', '1mo') === U(2026, 3, 1, 5) && C._pstart(U(2026, 11, 17, 15), 'Asia/Jerusalem', '1wk') === U(2026, 11, 15, 22), 'תחילת תקופה: 1/3 בחורף, שני בשעון ישראל');
ok(C._pstart(U(2026, 11, 17, 15), 'Not/AZone', '1wk') === U(2026, 11, 16), 'אזור זמן לא מוכר — UTC, בלי חריגה');

/* ---------- השורה החיה של Yahoo (C-003) — רק במה שלא נצבר מהיומי ---------- */
// ת"א 1mo: שורה רגילה עד אתמול + שורה חיה של היום → שורה אחת, נפח = סכום (כמו TEVA.TA, ‏31,049,997 + 1,641,795)
const tm = C._parse(yj('Asia/Jerusalem', [[U(2026, 9, 30, 21), 13000, 14100, 12300, 14030, 3e7], [U(2026, 10, 31, 22), 14030, 14110, 12310, 14030, 31049997],
  [U(2026, 11, 16, 15, 24), 14150, 14440, 14150, 14150, 1641795]], 'ILA'), '1mo');
ok(tm.t.length === 2 && tm.t[1] === U(2026, 10, 31, 22) && tm.v[1] === 32691792 && tm.h[1] === 144.4 && tm.l[1] === 123.1 && tm.c[1] === 141.5 && tm.o[1] === 140.3,
  'חודשי של Yahoo: השורה החיה מתמזגת לשורת החודש (גבוה/נמוך/סגירה/נפח), בלי שני נרות');
// ת"א 1wk ביום שני: השורה החיה היא היום הראשון של שבוע חדש — מתויגת בשני 00:00 שעון ישראל
const tw = C._parse(yj('Asia/Jerusalem', [[U(2026, 11, 1, 22), 1, 2, 1, 2, 5], [U(2026, 11, 8, 22), 2, 3, 2, 3, 6], [U(2026, 11, 16, 15, 24), 3, 4, 3, 4, 7]]), '1wk');
ok(tw.t.length === 3 && tw.t[2] === U(2026, 11, 15, 22) && tw.v[2] === 7, 'שבועי של Yahoo: שורה חיה בשבוע חדש — תווית תחילת השבוע, לא שעת העסקה');
// שבוע חמישי–רביעי (סמלים מלפני 1970, למשל ‎^N225): השורה החיה של שלישי מתמזגת לשבוע שהתחיל בחמישי; חמישי חדש — שבוע חדש
const nk = (live) => C._parse(yj('Asia/Tokyo', [[U(2026, 11, 4, 15), 1, 2, 1, 2, 5], [U(2026, 11, 11, 15), 2, 3, 2, 3, 6], [live, 3, 9, 1, 4, 7]]), '1wk');
ok(nk(U(2026, 11, 17, 6)).t.length === 2 && nk(U(2026, 11, 17, 6)).h[1] === 9 && nk(U(2026, 11, 17, 6)).v[1] === 13, 'שבוע של Yahoo שמתחיל בחמישי: שורה חיה בשלישי מתמזגת');
ok(nk(U(2026, 11, 19, 6)).t.length === 3 && nk(U(2026, 11, 19, 6)).t[2] === U(2026, 11, 18, 15), 'שבוע של Yahoo שמתחיל בחמישי: חמישי חדש — שורה חדשה בחצות טוקיו');
// מט"ח 1wk בלי שורה חיה — לא משתנה
const fx = C._parse(yj('Europe/London', [[U(2026, 11, 2), 1, 2, 1, 2, 0], [U(2026, 11, 9), 2, 3, 2, 3, 0], [U(2026, 11, 16), 3, 4, 3, 4, 0]]), '1wk');
ok(same(fx.t, [U(2026, 11, 2), U(2026, 11, 9), U(2026, 11, 16)]), 'שבועי בלי שורה חיה — כמו שהוא');
ok(C._parse(yj('America/New_York', [[U(2026, 11, 16, 14, 30), 1, 2, 1, 2, 5], [U(2026, 11, 17, 14, 30), 2, 3, 2, 3, 6]]), '1d').t.length === 2, 'יומי — בלי מיזוג');

/* ---------- סוף החודש בטלפון (chart.js) ---------- */
const cj = fs.readFileSync(path.join(root, 'chart.js'), 'utf8');
const seg = (a, b) => { const i = cj.indexOf(a); assert(i >= 0, a); return cj.slice(i, cj.indexOf(b, i)); };
const monthEnd = new Function(seg('const TZOFF = new Map();', 'const dayKeyFor') + seg('function monthEnd(', '/* סוף נר הבסיס') + '; return monthEnd;')();
const ms = (s) => s * 1000;
ok(monthEnd('America/New_York', ms(U(2026, 11, 1, 4)), 1) === ms(U(2026, 12, 1, 5)) && monthEnd('America/New_York', ms(U(2026, 10, 1, 4)), 1) === ms(U(2026, 11, 1, 4)),
  'סוף החודש: חצות של 1 בחודש הבא בשעון הבורסה (גם במעבר שעון)');
ok(monthEnd('America/New_York', ms(U(2026, 10, 1, 4)), 3) === ms(U(2027, 1, 1, 5)) && monthEnd('America/New_York', ms(U(2026, 7, 1, 4)), 6) === ms(U(2027, 1, 1, 5))
  && monthEnd('America/New_York', ms(U(2026, 1, 1, 5)), 12) === ms(U(2027, 1, 1, 5)), 'רבעון / חצי שנה / שנה — סוף התקופה הקלנדרית');
ok(monthEnd('Asia/Jerusalem', ms(U(2026, 10, 31, 22)), 1) === ms(U(2026, 11, 30, 22)) && monthEnd('UTC', ms(U(2026, 11, 1)), 1) === ms(U(2026, 12, 1)), 'סוף החודש בשעון ישראל וב־UTC');
// חודש של 31 יום: סגירת 31/12 בתוך הנר (היה 30 יום מתחילתו — הסגירה הרשמית לא תוקנה ב־31 לחודש)
ok(ms(U(2026, 12, 31, 21)) <= monthEnd('America/New_York', ms(U(2026, 12, 1, 5)), 1) && ms(U(2026, 12, 31, 21)) > ms(U(2026, 12, 1, 5)) + 2592000 * 1000, 'סגירת היום האחרון בחודש של 31 יום — בתוך הנר');
ok(/const d = TF\[c\.tf\], ms = \(d\.base === '1mo' \? monthEnd\(c\.tz, bar\.timestamp, d\.cal \|\| 1\) : bar\.timestamp \+ c\.secReal \* 1000\) - now;/.test(cj)
  && /if \(!\(ms > 0\) \|\| now < bar\.timestamp\) return '';/.test(cj), 'ספירה לאחור בחודשי/רבעוני/שנתי — עד סוף התקופה הקלנדרית (C-026)');

/* ---------- handle: Yahoo מדומה ---------- */
(async () => {
  const calls = [];
  const daily = (tz) => yj(tz, [[U(2026, 10, 30, 13, 30), 10, 12, 9, 11, 100], [U(2026, 11, 2, 14, 30), 11, 13, 10, 12, 200], [U(2026, 11, 3, 14, 30), 12, 14, 11, 13, 300]]);
  global.fetch = async (url) => {
    calls.push(url);
    const sym = decodeURIComponent(url.split('/chart/')[1].split('?')[0]), iv = url.match(/interval=([^&]+)/)[1];
    if (sym === 'NOPE') return { status: 404, json: async () => ({}) };
    if (iv === '1d') return { status: 200, json: async () => daily(sym === 'JPN' ? 'Asia/Tokyo' : 'America/New_York') };
    return { status: 200, json: async () => yj('Asia/Jerusalem', [[U(2026, 11, 1, 22), 1, 2, 1, 2, 5], [U(2026, 11, 8, 22), 2, 3, 2, 3, 6]]) };
  };
  const call = (body, ip = '9.9.9.' + (n % 200)) => new Promise((done) => {
    const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; done(this); return this; } };
    C.handle(body, res, ip, Date.UTC(2026, 10, 17, 12));
  });
  C._cache.clear();
  const [a, b] = await Promise.all([call({ op: 'candles', sym: 'TST', iv: '1wk' }), call({ op: 'candles', sym: 'TST', iv: '1mo' })]);
  ok(calls.length === 1 && /interval=1d/.test(calls[0]) && /period1=0&/.test(calls[0]), 'שבועי וחודשי יחד: בקשת יומי אחת ל־Yahoo (כל ההיסטוריה), לא 1wk/1mo');
  ok(a.code === 200 && a.body.ok && a.body.iv === '1wk' && same(a.body.t, [U(2026, 10, 26, 4), U(2026, 11, 2, 5)]) && a.body.more === false && same(a.body.v, [100, 500]), 'התשובה השבועית — צבירה של היומי');
  ok(b.body.iv === '1mo' && same(b.body.t, [U(2026, 10, 1, 4), U(2026, 11, 1, 4)]) && same(b.body.c, [11, 13]), 'התשובה החודשית — צבירה של היומי');
  await call({ op: 'candles', sym: 'TST', iv: '1mo' });
  ok(calls.length === 1, 'בקשה חוזרת בתוך דקה — מהמטמון');
  await call({ op: 'candles', sym: 'TEVA.TA', iv: '1wk' });
  ok(calls.length === 2 && /interval=1wk/.test(calls[1]), 'בורסה זרה (סיומת) — ישר לשבועי של Yahoo, בלי יומי');
  await call({ op: 'candles', sym: 'JPN', iv: '1wk' });
  ok(calls.length === 4 && /interval=1d/.test(calls[2]) && /interval=1wk/.test(calls[3]), 'אזור זמן שלא נבדק — חזרה לשבועי של Yahoo');
  C._cache.clear();
  await call({ op: 'candles', sym: 'JPN', iv: '1mo' });
  ok(calls.length === 5 && /interval=1mo/.test(calls[4]), 'אותו סמל אחר כך — בלי בקשת היומי המיותרת');
  const nf = await call({ op: 'candles', sym: 'NOPE', iv: '1mo' });
  ok(nf.code === 200 && nf.body.ok === false && nf.body.error === 'not_found', 'סמל לא קיים — not_found');
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
