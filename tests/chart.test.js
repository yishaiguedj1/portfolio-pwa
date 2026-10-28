// גרף הנרות (chartlib.js + chart.js + op:'candles', 27/10/2026): חישובים טהורים מול ערכים ידניים, עמידות על נתונים אקראיים,
// השרתון (פירוק Yahoo, חלונות זמן), ושילוב באפליקציה (כפתור, מחרוזות, מטמון, CSP).
// הרצה: node tests/chart.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let n = 0;
const ok = (c, name) => { n++; assert(c, name); console.log('ok -', name); };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'chartlib.js'), 'utf8');
const sb = { console, Date, Math, JSON, Map, Set, Array, Number, Infinity, isFinite };
vm.createContext(sb);
vm.runInContext(src.replace(/^export (async )?(function|const)/gm, '$1$2') + '\n;globalThis.L = _test;', sb);
const L = sb.L;

/* ---------- ממוצעים ---------- */
ok(JSON.stringify(L.sma([1, 2, 3, 4, 5], 3).slice(2)) === '[2,3,4]', 'SMA 3');
const e = L.ema([1, 2, 3, 4, 5], 3);
ok(e[1] === undefined && near(e[2], 2) && near(e[3], 3) && near(e[4], 4), 'EMA נזרע בממוצע פשוט ואז 2/(n+1)');
ok(near(L.wma([1, 2, 3], 3)[2], (1 + 4 + 9) / 6), 'WMA משקלים 1..n');
ok(near(L.rma([2, 4, 6, 8], 2)[3], ((3 * 1 + 6) / 2 * 1 + 8) / 2), 'RMA (Wilder)');
const r = L.rsi([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 14);
ok(r[14] === 100, 'RSI = 100 כשאין ירידות');

/* ---------- נתונים סינתטיים ---------- */
function walk(N, seed, stepMs, t0) {
  let s = seed || 7, p = 100;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const out = [];
  for (let i = 0; i < N; i++) {
    const o = p, c = Math.max(1, o * (1 + (rnd() - 0.5) * 0.04));
    out.push({ timestamp: (t0 || Date.UTC(2026, 0, 2, 14, 30)) + i * (stepMs || 60000), open: o, high: Math.max(o, c) * (1 + rnd() * 0.01), low: Math.min(o, c) * (1 - rnd() * 0.01), close: c, volume: Math.round(1000 + rnd() * 9000) });
    p = c;
  }
  return out;
}
const B = walk(600, 11, 86400000, Date.UTC(2023, 0, 2));

/* ---------- כל האינדיקטורים: אורך זהה, ערכים סופיים, בלי חריגה ---------- */
for (const k of Object.keys(L.IND)) {
  const def = L.IND[k];
  const res = L.CALC[k](B, def.p.map((x) => x[1]), { intra: false, cmp: walk(600, 5, 86400000, Date.UTC(2023, 0, 2)) });
  const keys = def.f.map((f) => f[0]);
  const bad = res.some((o) => Object.keys(o).some((x) => !keys.includes(x) || (o[x] != null && !isFinite(o[x]))));
  const has = res.some((o) => keys.some((x) => o[x] != null));
  assert(res.length === B.length && !bad && has, k);
}
ok(true, Object.keys(L.IND).length + ' אינדיקטורים: אורך כמו הנרות, רק המפתחות שהוגדרו, ערכים סופיים');
ok(Object.keys(L.IND).length >= 40, 'לפחות 40 אינדיקטורים נוספים (ועוד 27 המובנים של KLineChart)');
{
  const st = L.CALC.STOCH(B, [14, 3, 3]).filter((o) => o.k != null);
  ok(st.every((o) => o.k >= 0 && o.k <= 100), 'Stochastic בין 0 ל־100');
  const ad = L.CALC.ADX(B, [14]).filter((o) => o.adx != null);
  ok(ad.length > 500 && ad.every((o) => o.adx >= 0 && o.adx <= 100), 'ADX בין 0 ל־100');
  const sup = L.CALC.SUPERTREND(B, [10, 3]);
  ok(sup.slice(20).every((o) => (o.up != null) !== (o.dn != null)), 'Supertrend: בכל נר צד אחד בלבד');
  const ich = L.CALC.ICHIMOKU(B, [9, 26, 52]);
  ok(ich[100].spanA != null && ich[100].spanB != null && ich[B.length - 1].chikou == null && ich[B.length - 26].chikou === B[B.length - 1].close, 'Ichimoku: ענן מוזז קדימה, Chikou אחורה');
}
{ // VWAP מתאפס בכל יום בתוך־יומי
  const I = walk(780, 3, 60000, Date.UTC(2026, 0, 5, 14, 30)).filter((b) => (b.timestamp - Date.UTC(2026, 0, 5, 14, 30)) % 86400000 < 390 * 60000);
  const two = I.concat(I.map((b) => Object.assign({}, b, { timestamp: b.timestamp + 86400000 })));
  const v = L.CALC.VWAP(two, [1, 2], { intra: true, dayKey: (t) => Math.floor(t / 86400000) });
  const first2 = two.findIndex((b) => b.timestamp >= Date.UTC(2026, 0, 6));
  const tp = (two[first2].high + two[first2].low + two[first2].close) / 3;
  ok(near(v[first2].vwap, tp), 'VWAP מתאפס בתחילת יום מסחר');
}

/* ---------- צבירה ---------- */
{
  // 45 דק׳ מנרות 15 דק׳ — מעוגן ל־9:30 (תחילת הסשן), לפי ת־גרף
  const t0 = Date.UTC(2026, 0, 5, 14, 30);
  const m15 = Array.from({ length: 26 }, (_, i) => ({ timestamp: t0 + i * 900000, open: i, high: i + 1, low: i - 1, close: i + 0.5, volume: 10 }));
  const day2 = m15.map((b) => Object.assign({}, b, { timestamp: b.timestamp + 86400000 }));
  const a = L.aggregate(m15.concat(day2), '45m');
  ok(a[0].timestamp === t0 && a[1].timestamp === t0 + 2700000 && a[0].open === 0 && a[0].close === 2.5 && a[0].high === 3 && a[0].low === -1 && a[0].volume === 30, '45m: פתיחה/גבוה/נמוך/סגירה/נפח מ־3 נרות');
  ok(a.some((b) => b.timestamp === t0 + 86400000), '45m: הסשן הבא מתחיל עוגן חדש (9:30)');
  const mo = Array.from({ length: 24 }, (_, i) => ({ timestamp: Date.UTC(2024, i, 1, 4), open: i, high: i + 2, low: i - 2, close: i + 1, volume: 1 }));
  const q = L.aggregate(mo, '3M');
  ok(q.length === 8 && q[0].open === 0 && q[0].close === 3 && q[1].open === 3, '3M: רבעונים קלנדריים');
  ok(L.aggregate(mo, '12M').length === 2, '12M: שנה');
}
/* ---------- טיק חי ---------- */
{
  const bars = [{ timestamp: 0, open: 10, high: 11, low: 9, close: 10, volume: 5 }];
  L.applyTick(bars, { price: 12, time: 30000, dv: 3 }, { sec: 60, intra: true });
  ok(bars.length === 1 && bars[0].high === 12 && bars[0].close === 12 && bars[0].volume === 8, 'טיק בתוך הנר: סגירה, גבוה ונפח');
  const res = L.applyTick(bars, { price: 8, time: 185000, dv: 1 }, { sec: 60, intra: true });
  ok(res.added && bars.length === 2 && bars[1].timestamp === 180000 && bars[1].open === 8, 'טיק אחרי סוף הנר: נר חדש מעוגן');
  const d = [{ timestamp: 0, open: 10, high: 10, low: 10, close: 10, volume: 1 }];
  L.applyTick(d, { price: 11, time: 3600000, regular: false }, { sec: 86400, intra: false, base: '1d', dayKey: () => 'x' });
  ok(d[0].close === 10, 'יומי: מחיר טרום/אחרי מסחר לא משנה את הנר');
  L.applyTick(d, { price: 11, time: 3600000, regular: true, dayVol: 99 }, { sec: 86400, intra: false, base: '1d', dayKey: () => 'x' });
  ok(d[0].close === 11 && d[0].volume === 99, 'יומי: הסשן הרגיל מעדכן סגירה ונפח היום');
  const m = L.mergeBars([{ timestamp: 1 }, { timestamp: 2 }, { timestamp: 3 }], [{ timestamp: 3, x: 1 }, { timestamp: 4 }]);
  ok(m.length === 4 && m[2].x === 1, 'מיזוג נרות טריים מחליף מאותה חותמת והלאה');
}
/* ---------- סוגי גרף ---------- */
{
  const ha = L.heikinAshi(B);
  ok(ha.length === B.length && ha.every((b) => b.high >= Math.max(b.open, b.close) && b.low <= Math.min(b.open, b.close)), 'Heikin Ashi: גבוה/נמוך עוטפים');
  ok(near(ha[1].open, (ha[0].open + ha[0].close) / 2), 'Heikin Ashi: פתיחה = ממוצע הנר הקודם');
  const rk = L.renko(B, 2);
  ok(rk.length > 10 && rk.every((b) => near(Math.abs(b.close - b.open), 2)) && rk.every((b, i) => !i || b.timestamp > rk[i - 1].timestamp), 'Renko: לבנים בגודל קבוע, זמנים עולים');
  const lb = L.lineBreak(B, 3);
  ok(lb.length > 5 && lb.every((b, i) => !i || b.timestamp > lb[i - 1].timestamp), 'Line Break');
  const kg = L.kagi(B, 0.04);
  ok(kg.length > 3, 'Kagi');
}
/* ---------- ניתוח אוטומטי ---------- */
{
  const zz = L.zigzag(B, 0.05);
  ok(zz.length > 4 && zz.every((s, i) => !i || s.hi !== zz[i - 1].hi), 'ZigZag: מפנים מתחלפים גבוה/נמוך');
  ok(zz.slice(1, -1).every((s, i) => Math.abs(s.price / zz[i].price - 1) >= 0.05 - 1e-9), 'ZigZag: כל מהלך לפחות 5%');
  const sw = L.swings(B, 5);
  ok(sw.length > 10 && sw.every((s) => s.price === (s.hi ? B[s.i].high : B[s.i].low)), 'נקודות מפנה');
  const tl = L.autoTrendlines(B);
  ok(Array.isArray(tl) && tl.every((x) => (x.kind === 'sup' || x.kind === 'res') && x.touches >= 2), 'קווי מגמה אוטומטיים');
  const lv = L.autoLevels(B, 6);
  ok(lv.length > 0 && lv.length <= 6 && lv.every((x, i) => !i || x.price <= lv[i - 1].price), 'רמות תמיכה/התנגדות ממוינות');
  const fib = L.autoFib(B);
  ok(fib && fib.a.t < fib.b.t, 'פיבונאצ׳י אוטומטי: מהלך אחרון');
  // נר בולע עולה
  const eng = [{ timestamp: 0, open: 10, high: 10.2, low: 9, close: 9.2 }, { timestamp: 1, open: 9.4, high: 9.5, low: 8.6, close: 8.8 }, { timestamp: 2, open: 9, high: 9.1, low: 8, close: 8.2 },
    { timestamp: 3, open: 8.4, high: 8.5, low: 7.8, close: 7.9 }, { timestamp: 4, open: 7.7, high: 9.4, low: 7.6, close: 9.3 }];
  ok(L.candlePatterns(eng).some((p) => p.key === 'engulfBull' && p.i === 4 && p.dir === 1), 'זיהוי נר בולע עולה');
  const doji = eng.concat([{ timestamp: 5, open: 9, high: 9.5, low: 8.5, close: 9.01 }]);
  ok(L.candlePatterns(doji).some((p) => p.key === 'doji' && p.i === 5), 'זיהוי דוג׳י');
  ok(Array.isArray(L.chartPatterns(B)), 'תבניות גרף');
  const vp = L.volumeProfile(B, 24);
  const tot = B.reduce((s, b) => s + b.volume, 0);
  ok(near(vp.tot.reduce((s, x) => s + x, 0), tot, 1e-3) && vp.val <= vp.pocPrice && vp.vah >= vp.pocPrice, 'פרופיל נפח: כל הנפח מחולק, POC בתוך אזור הערך');
  const se = L.seasonality(B);
  ok(se.months.length === 12 && se.months.every((m) => m.n > 0), 'עונתיות לפי חודש');
  const em = L.expectedMove(B, 10, 252);
  ok(em && em.pts.length === 10 && em.pts[9].up1 > em.pts[0].up1 && em.pts[0].dn2 < em.pts[0].dn1, 'קונוס תנועה צפויה מתרחב');
  const rs = L.rangeStats(B, 10, 20);
  ok(rs.bars === 10 && near(rs.pct, (B[20].close / B[10].close - 1) * 100), 'סטטיסטיקת טווח');
  const bt = L.backtest(B, { kind: 'ma', fast: 9, slow: 21 });
  ok(bt.trades.length > 3 && bt.dd >= 0 && bt.dd < 1 && bt.curve.length === B.length, 'בדיקה לאחור: עסקאות, ירידה מקסימלית, עקומה');
  const pc = L.positionCalc(100, 95, 115, 500);
  ok(pc.qty === 100 && pc.rr === 3, 'מחשבון פוזיציה: כמות ויחס סיכוי/סיכון');
}
/* ---------- שמירת מצב ---------- */
{
  const s = L.sanitizeLayout({ tf: 'BAD', ind: [{ n: 'RSI', p: [14, 'x'] }, { n: '<script>' }], dr: [{ name: 'segment', points: [{ timestamp: 1, value: 2 }, { timestamp: 'x' }] }] });
  ok(s.tf === '1D' && s.ind.length === 1 && s.ind[0].p.length === 1 && s.dr[0].points.length === 1, 'מצב שמור עובר ניקוי (שם אינדיקטור, פרמטרים, נקודות)');
  ok(L.sanitizeLayout(null).tf === '1D', 'מצב שבור → ברירת מחדל');
}

/* ---------- השרתון: op:'candles' ---------- */
{
  const C = require(path.join(root, 'ibkr-proxy/lib/candles.js'));
  const j = { chart: { result: [{ meta: { currency: 'ILA', exchangeTimezoneName: 'Asia/Jerusalem', longName: 'X' }, timestamp: [100, 160, 220, 220],
    indicators: { quote: [{ open: [1000, null, 1200, 1], high: [1100, null, 1150, 1], low: [900, null, 1190, 1], close: [1050, null, 1210, 1], volume: [5, 0, 7, 0] }] } }] } };
  const p = C._parse(j, '1m');
  ok(p.t.length === 2 && p.c[0] === 10.5 && p.h[1] === 12.1 && p.l[1] === 11.9 && p.cur === 'ILS' && p.tz === 'Asia/Jerusalem', 'פירוק Yahoo: אגורות לשקלים, חור ונר כפול מדולגים, גבוה/נמוך עקביים');
  // נר רפאים של Yahoo בשעת סגירת המסחר הרגיל (שטוח, בלי נפח) — מדולג בתוך־יומי; נר שטוח אמיתי עם נפח — נשאר
  const g = (v) => ({ chart: { result: [{ meta: { currency: 'USD', currentTradingPeriod: { regular: { start: 0, end: 1200 } } }, timestamp: [300, 1200],
    indicators: { quote: [{ open: [10, 11], high: [12, 11], low: [9, 11], close: [11, 11], volume: [5, v] }] } }] } });
  ok(C._parse(g(0), '15m').t.length === 1 && C._parse(g(0), '15m').c[0] === 11, 'נר רפאים בסגירה מדולג (תווית המחיר נצבעת לפי הנר האמיתי)');
  ok(C._parse(g(3), '15m').t.length === 2 && C._parse(g(0), '1d').t.length === 2, 'נר שטוח עם נפח / יומי — נשאר');
  // עם טרום/אחרי: נקודה חיה בסוף שלא מיושרת לטווח (20:50 ב־15m) — מתמזגת לנר הקודם, לא נר אפור חדש
  const lv = C._parse({ chart: { result: [{ meta: { currency: 'USD' }, timestamp: [900, 1800, 2400],
    indicators: { quote: [{ open: [10, 11, 12], high: [11, 12, 12], low: [9, 10, 12], close: [11, 11.5, 12], volume: [1, 2, 0] }] } }] } }, '15m');
  ok(lv.t.length === 2 && lv.c[1] === 12 && lv.h[1] === 12 && lv.o[1] === 11 && lv.v[1] === 2, 'נקודה חיה לא מיושרת מתמזגת לנר הקודם');
  const kl = fs.readFileSync(path.join(root, 'vendor/klinecharts/klinecharts.min.js'), 'utf8');
  ok(kl.includes('(this._touchCoordinate=null,l.setCrosshair(void 0,{notInvalidate:!0}),n=!0,this._touchCancelCrosshair=!1)') && kl.includes('a=10*(e/this._pinchScale-1)') && /Modified by THE SNOWBALL/.test(kl),
    'KLineChart: הקשה לא פותחת צלב (רק לחיצה ארוכה) וצביטה 1:1 — מסומן בראש הקובץ (Apache-2.0)');
  const cj = fs.readFileSync(path.join(root, 'chart.js'), 'utf8');
  ok(/const extOn = !!\(q && q\.ext && q\.ext\.p > 0 && st !== 'REGULAR'/.test(cj) && /p = extOn \? q\.ext\.p : reg/.test(cj) && /reg - prev/.test(cj), 'כותרת כמו כרטיס המניה: מחיר מורחב ראשי, גלולה, ושינוי היום מהסגירה הרגילה');
  ok(/function renderMbar\(\)/.test(cj) && /function wheel\(b, items, pick, tx = b\)/.test(cj) && /function openPlus\(c\)/.test(cj) && /function plusAt\(c, x\)/.test(cj) && /name: 'horizontalStraightLine', points: \[\{ timestamp: lastTs\(c\), value: p \}\]/.test(cj), 'טלפון לפי ת־גרף: סרגל תחתון, גלגלת, "+" בציר (התראה / קו אופקי)');
  const cc = fs.readFileSync(path.join(root, 'chart.css'), 'utf8');
  // 28/10: מדידה בטלפון במצב צלב — צלב שזז יחסית לאצבע, הקשה = נקודה, הקשה שנייה = סיום ובחירה
  ok(/const CUR_TOOLS = new Set\(\['kcMeasure', 'kcPriceRange', 'kcDateRange'\]\)/.test(cj) && /if \(CUR_TOOLS\.has\(name\) && coarse\(\) && curBegin\(c, name\)\)/.test(cj)
    && /executeAction\('onCrosshairChange', \{ x: r\.x, y: r\.y, paneId: MAIN \}\)/.test(cj) && /overrideOverlay\(\{ id: s\.id, points: \[s\.p1, r\.pt\] \}\)/.test(cj)
    && /S\.cur\.x = Math\.max\(0, Math\.min\(sz \? sz\.width - 1 : 9999, ct\.cx \+ dx\)\)/.test(cj) && /if \(o\) select\(c, o\);/.test(cj), 'מדידה בטלפון: מצב צלב');
  ok(/createYAxisFigures: \(\{ chart, overlay, coordinates, bounding, yAxis \}\) => \{\n      if \(coordinates\.length < 2 \|\| mode === 'd' \|\| !mSel\(overlay\)\)/.test(cj) && /type: 'circle', ignoreEvent: true, attrs: \{ x: q\.x, y: q\.y, r: 9 \}/.test(cj), 'מדידה שנבחרה: ידיות ופס כחול על הצירים');
  // 28/10: כותרת זכוכית מעל הגרף בטלפון; רשימה והגדרות בסרגל התחתון
  ok(/ib\('watch', T\('kcWatch'\), toggleWatch, S\.watch\)/.test(cj) && /ib\('gear', T\('kcSettings'\), openSettings\)/.test(cj) && /offsetTop: topPad\(c\)/.test(cj)
    && /\.kc-top \{ position: absolute; top: 0; inset-inline: 0; z-index: 8;/.test(cc) && /\.kc-top-end \.kc-ib \{ display: none; \}/.test(cc), 'טלפון: כותרת זכוכית מעל הגרף, רשימה והגדרות למטה');
  // 28/10: מחיר הכותרת כמו בכרטיס המניה — 27px/14px ואפקט הגלגול של רובין הוד (livePriceSwap דרך E.pxSwap)
  ok(/if \(E\.pxSwap && p\) E\.pxSwap\(pel, pt, p\)/.test(cj) && /\.kc-px \{ font-weight: 800; font-size: 27px;/.test(cc) && /pxSwap: \(a, txt, px\) => \{[^}]*livePriceSwap\(a, b\)/.test(fs.readFileSync(path.join(root, 'app.js'), 'utf8')), 'מחיר הכותרת בגרף כמו בכרטיס המניה');
  // 28/10 (בקשת המשתמש): כותרת בזכוכית מדורגת (5 שכבות טשטוש עם מסכות), סרגל תחתון צף ושקוף — ציר התאריכים גדל בגובהו
  ok(/class: 'kc-pb', 'aria-hidden': 'true' \}, \.\.\.\[1, 2, 3, 4, 5\]/.test(cj) && /\.kc-pb i:nth-child\(5\)/.test(cc) && /\.kc-top \{ background: none;/.test(cc)
    && /function xSize\(\)/.test(cj) && /xAxis: \{ size: xSize\(\) \}/.test(cj) && /\.kc-mbar \{ position: absolute; left: 0; right: 0; bottom: 0;/.test(cc) && /\.kc-pk \{ align-items: center; text-align: center; \}/.test(cc), 'בטלפון: כותרת בזכוכית מדורגת וסרגל תחתון צף');
  // 28/10 (בקשת המשתמש): נפח המסחר בתוך הגרף, מאחורי הנרות; מרווח הציר כך שמחיר השיא לא עולה על שורת המקרא; בועת "שוק סגור" כמו ב־Invest
  ok(/KCVOL: \{ g: 'volume', main: 1 \}/.test(cj) && /globalCompositeOperation = 'destination-over'/.test(cj) && /function volGap\(c\)/.test(cj) && /overrideYAxis\(\{ paneId: MAIN, gap:/.test(cj)
    && /E\.closedEl\(/.test(cj) && /closedEl: \(q\) =>/.test(fs.readFileSync(path.join(root, 'app.js'), 'utf8')) && /\.kc-qm[^{]*\{[^}]*\+ 44px\)/.test(cc), 'בטלפון: נפח בתוך הגרף, שיא בלי דריסה, בועת שוק סגור');
  // 28/10 (בקשת המשתמש): עריכת מדידה אחרי שנוצרה — גרירת ידית משנה את הנקודה שלה, עם היסט האצבע
  ok(/const edGet = \(\) =>[^\n]*CUR_TOOLS\.has\(o\.name\) && !o\.lock/.test(cj) && /pts\[ed\.i\] = sn\.pt;/.test(cj) && /if \(d\.moved\) changed\(c\);/.test(cj), 'מדידה שנבחרה: גרירת הידיות עורכת אותה');
  // 28/10 (בקשת המשתמש): גיליונות ורשימת המעקב מזכוכית עם טשטוש מאחור; המגירה נסגרת בנגיעה בחוץ, ב"חזור" ובפתיחת תפריט אחר; תוכן ארוך לא מכווץ בוררים; סרגל עריכה = גלולת זכוכית
  ok(/\.kc-sh-back \{ background: rgba\(242, 242, 247, \.28\); -webkit-backdrop-filter: blur\(24px\)/.test(cc) && /\.kc-sh-body > \* \{ flex-shrink: 0; \}/.test(cc) && /\.kc-wveil\.on \{ display: block; position: fixed;/.test(cc)
    && /UI\.wveil = h\('div', \{ class: 'kc-wveil', onclick: \(\) => closeWatch\(\) \}\)/.test(cj) && /S\.wModal = E\.modalPush\(\(\) => closeWatch\(true\)\)/.test(cj) && /if \(S\.watch && narrow\(\)\) closeWatch\(\);/.test(cj)
    && /\.kc-selbar \.kc-wcyc, \.kc-selbar \.kc-dash \{ display: none !important; \}/.test(cc) && /ROOT\.style\.setProperty\('--kc-toph'/.test(cj), 'בטלפון: גיליונות זכוכית, מגירת המעקב נסגרת, סרגל עריכה נקי');
  ok(/legend: \{ color: p\.text, size: narrow\(\) \? 10 : 11, family: p\.font, marginLeft: narrow\(\) \? 3 : 6/.test(cj), 'בטלפון: שורת המחירים בשורה אחת');
  // 28/10: מסחר לילי — היה חסר ב־parseQuote; תווית לפי סשן
  ok(/st === 'OVERNIGHT' \|\| st === 'CLOSED' \|\| st === 'PREPRE'\) \? x\.night/.test(cj) && /night: 'kcNight'/.test(cj) && /const EXTC = \{ pre: '#FF9F0A', post: '#0A84FF', night: '#BF5AF2' \}/.test(cj), 'מחיר לילי מוצג בגרף, בצבע ובתווית משלו');
  // 28/10 (בקשת המשתמש): בורר האינטרוול עבר מהסרגל התחתון לפינה העליונה של הגרף, ולידו "טווח תאריכים" (טווח הזמן שמוצג)
  ok(/function renderPick\(c\)/.test(cj) && /pill\(T\('kcPickTf'\)[\s\S]{0,200}?setTf\(c, it\.v\)/.test(cj) && /pill\(T\('kcPickRg'\)[\s\S]{0,200}?goRange\(it\.v\)/.test(cj)
    && /UI\.mbar\.append\(\n    ib\('watch'/.test(cj) && !/const symB = /.test(cj) && /\.kc-pick \{ display: flex; \}/.test(cc), 'בטלפון: "אינטרוול" ו"טווח תאריכים" בפינה העליונה של הגרף, לא בסרגל התחתון');
  ok(/\.kc-bar, \.kc-foot, \.kc-fab, \.kc-fab\.on, \.kc-top-end \.kc-undo, \.kc-top-end \.kc-redo \{ display: none !important; \}/.test(cc) && /\.kc-mbar \{ display: flex; \}/.test(cc), 'בטלפון הסרגל התחתון מחליף את הסרגלים של המחשב');
  ok(/b\.timestamp <= t && t <= b\.timestamp \+ BASESEC\[d\.base\] \* 1000 && b\.close !== p/.test(cj), 'הנר האחרון נסגר על מחיר הסגירה הרשמי');
  ok(/setZoomAnchor\(back \? 'cursor' : 'last_bar'\)/.test(cj) && /navigator\.vibrate\(8\)/.test(cj) && /convertFromPixel\(\[\{ x: e\.clientX - r\.left/.test(cj), 'זום צמוד לנר האחרון, רטט בלחיצה ארוכה, בחירת נר בהקשה');
  ok(/extendTexts: \[\{ show: true, position: 'below_price'[\s\S]{0,400}?updateInterval: 1000/.test(cj) && /formatExtendText: \(x\) => \(x && x.type === 'last_price' \? countdown\(c, x.data, Date.now\(\)\)/.test(cj), 'ספירה לאחור לסגירת הנר מתחת לתווית המחיר');
  ok(/name: 'kcExtPx'/.test(cj) && /function drawExt\(c\)/.test(cj) && /if \(c.raw.length\) \{ drawExt\(c\);/.test(cj), 'תווית טרום/אחרי המסחר בציר');
  ok(/name === 'VOL' && \(!conf.calcParams \|\| conf.calcParams.join\(\) === '5,10,20'\)\) conf.calcParams = \[\]/.test(cj), 'נפח נקי בלי ממוצעים');
  const now = 1_800_000_000;
  const w = C._window('1m', 0, now);
  ok(w.p2 === now && now - w.p1 === 7 * 86400 && w.more, '1m: חלון 7 ימים, יש עוד');
  ok(C._window('1m', now - 29.5 * 86400, now) === null, '1m: אין היסטוריה מעבר ל־30 יום');
  ok(C._window('1wk', 0, now).p1 === 0 && !C._window('1wk', 0, now).more, 'שבועי: הכל בבקשה אחת');
  const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  C.handle({ sym: 'AAPL', iv: '7m' }, res, '1.2.3.4');
  ok(res.code === 400, 'טווח לא מוכר → bad_params');
  C.handle({ sym: '../x', iv: '1d' }, res, '1.2.3.4');
  ok(res.code === 400, 'סימבול לא חוקי → bad_params');
  const hist = fs.readFileSync(path.join(root, 'ibkr-proxy/api/history.js'), 'utf8');
  ok(/op === 'candles'/.test(hist) && hist.indexOf("op === 'candles'") < hist.indexOf('if (rateLimited(ip))'), 'history.js: candles לפני הגבלת 20 לדקה (מגבלה משלו)');
}

/* ---------- שילוב באפליקציה ---------- */
{
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const ch = fs.readFileSync(path.join(root, 'chart.js'), 'utf8');
  ok(/function chartBtn\(sym\)/.test(app) && /import\('\.\/chart\.js'\)/.test(app), 'כפתור "גרף נרות" בכרטיס המניה, המודול נטען בלחיצה');
  ok(/kcOpenBtn: 'גרף נרות'/.test(app) && /kcOpenBtn: 'Candles'/.test(app), 'מחרוזת הכפתור בשתי השפות');
  ok(/'\.\/chart\.js'/.test(sw) && /'\.\/chartlib\.js'/.test(sw) && /'\.\/chart\.css'/.test(sw) && /klinecharts\.min\.js/.test(sw), 'הקבצים במטמון של ה־service worker');
  ok(/'pwa_charts_v1'/.test(app.match(/const ACCOUNT_KEYS = \[[^\]]*\]/)[0]), 'השרטוטים והפריסה — מפתח אישי (ACCOUNT_KEYS)');
  ok(/classList\.contains\('kc-open'\)/.test(app), 'לולאת המחירים של התיק עוצרת כשהגרף פתוח');
  ok(!/\bfetch\(/.test(ch) && !/localStorage/.test(ch), 'chart.js בלי fetch/localStorage ישירים — הכל דרך env');
  ok(!/\b(confirm|alert|prompt)\(/.test(ch.replace(/askConfirm|askAlert/g, '')), 'בלי confirm/alert/prompt');
  // מפתחות קבועים + מפתחות מטבלאות (כלים, קבוצות, סוגי גרף) + קידומות דינמיות (kcCp_doji…) — נבדקות בנפרד
  const keys = [...new Set([...ch.matchAll(/\bT\('(kc[A-Za-z0-9_]+)'/g)].map((m) => m[1]).filter((k) => !k.endsWith('_')))];
  for (const m of ch.matchAll(/'(kc(?:To|G|Ty|Ig|Tf)[A-Z][A-Za-z0-9]*)'/g)) if (!keys.includes(m[1])) keys.push(m[1]);
  const enAt = app.indexOf("kcOpenBtn: 'Candles'");
  const he = app.slice(app.indexOf('const STRINGS'), enAt);
  const en = app.slice(enAt);
  for (const k of Object.keys(L.IND)) keys.push('kcI_' + k);
  for (const k of ['KCAUTOTL', 'KCAUTOSR', 'KCAUTOFIB', 'KCCANDLES', 'KCPATTERNS', 'KCVPVR', 'KCCONE']) keys.push('kcAutoN_' + k);
  for (const m of src.matchAll(/key(?::| =) '([a-zA-Z]+)'/g)) if (!['sup', 'res', 'cmp'].includes(m[1])) keys.push((/^(hs|ihs|double|tri|wedge)/.test(m[1]) ? 'kcPt_' : 'kcCp_') + m[1]);
  for (const m of src.matchAll(/\? '([a-zA-Z]+)' :|: '([a-zA-Z]+)', dir/g)) { const k = m[1] || m[2]; if (k && !['sup', 'res'].includes(k)) keys.push((/^(hs|ihs|double|tri|wedge)/.test(k) ? 'kcPt_' : 'kcCp_') + k); }
  const miss = keys.filter((k) => !new RegExp('\\b' + k + ':').test(he) || !new RegExp('\\b' + k + ':').test(en));
  ok(keys.length > 50 && !miss.length, keys.length + ' מחרוזות של הגרף בעברית ובאנגלית' + (miss.length ? ' — חסר: ' + miss.join(',') : ''));
  const lic = fs.existsSync(path.join(root, 'vendor/klinecharts/LICENSE')) && fs.existsSync(path.join(root, 'vendor/klinecharts/NOTICE'));
  ok(lic, 'KLineChart: רישיון Apache-2.0 ו־NOTICE לצד הקובץ');
}

/* 28/10/2026: גלגלת הטווחים לפי ת־גרף · בחירה ומחיקה באצבע · התראות בכרטיס המניה */
{
  const ch = fs.readFileSync(path.join(root, 'chart.js'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'chart.css'), 'utf8');
  const st = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const wh = ch.slice(ch.indexOf('function wheel('), ch.indexOf('/* "עוד" בטלפון'));
  ok(/st\.loop = st\.n > 2/.test(wh) && /% st\.n\) \+ st\.n\) % st\.n/.test(wh), 'גלגלת: מעגלית (אחרי האחרון — הראשון)');
  ok(/st\.i0 - \(e\.clientY - st\.y\) \/ WH_ROW/.test(wh) && /requestAnimationFrame/.test(wh), 'גלגלת: גלילה רציפה עם האצבע (לא קפיצות), ציור בפריים');
  ok(/kc-roll/.test(wh) && /\.kc-roll-i \{/.test(css), 'גלגלת: התווית בכפתור מתגלגלת');
  ok(/it\.l \|\| it\.t/.test(wh) && /l: tfLong\(tf\)/.test(ch) && /unitDisplay: 'long'/.test(ch), 'גלגלת: שמות מלאים ("15 דקות") דרך Intl');
  ok(/\.kc-wheel\.on \{/.test(css) && /rgba\(28, 28, 30, \.92\)/.test(css), 'גלגלת: חלון כהה עם כניסה רכה');
  ok(!/style: '/.test(wh) && /e\.style\.transform = /.test(ch), 'גלגלת: מיקום דרך CSSOM (CSP)');
  const hit = ch.slice(ch.indexOf('function hitAt('), ch.indexOf('function wireCellPointer'));
  ok(/const HIT_PX = 14;/.test(ch) && /groupId: 'alert'/.test(hit) && /groupId: 'user'/.test(hit) && /segDist/.test(hit), 'מגע: פגיעה באובייקט עד 14px — קווי התראה ושרטוטים');
  const wp = ch.slice(ch.indexOf('function wireCellPointer'), ch.indexOf('/* ---------- גיליונות'));
  ok(/hitAt\(c, down\.x - r\.left, down\.y - r\.top\)/.test(wp) && /openObjMenu\(\)/.test(wp), 'לחיצה ארוכה על אובייקט — בחירה ותפריט עם מחיקה, בלי הקשה קודמת');
  ok(/hitAt\(c, d0\.x - r\.left, d0\.y - r\.top\)/.test(wp) && /deselect\(\)/.test(wp), 'הקשה על אובייקט בוחרת, על רקע ריק — מבטלת');
  ok(/export function stockAlerts\(/.test(ch) && /export async function openStockAlert\(/.test(ch), 'chart.js מייצא התראות לכרטיס המניה');
  const oa = ch.slice(ch.indexOf('export async function openStockAlert'), ch.indexOf('/* עונתיות'));
  ok(/bgSync\(true\)/.test(oa) && /kc-float/.test(oa) && /onAlerts/.test(oa), 'עורך מהכרטיס: רישום לרקע (ברירת מחדל), שורש שקוף, עדכון הכרטיס');
  ok(/if \(S\.cells\.length\) S\.store\.g\.cells = /.test(ch), 'שמירה בלי הגרף פתוח לא דורסת את הפריסה');
  ok(/\.kc-root\.kc-float \{/.test(css), 'שורש שקוף לגיליון מחוץ לגרף');
  ok(/function stockAlertsEl\(sym\)/.test(app) && /wrap\.appendChild\(stockAlertsEl\(sym\)\)/.test(app), 'כרטיס המניה: מקטע התראות המחיר');
  ok((app.match(/actions\.appendChild\(alertBtn\(sym\)\)/g) || []).length === 2 && /if \(p\.watch \|\| !isIbkrMode\(\) \|\| p\.src === 'manual'\)/.test(app), 'כפתור פעמון בכל סוגי הכרטיס (מעקב וידני בענף אחד, IBKR בשני)');
  ok(/onClose: \(\) => refreshStockAlerts\(\)/.test(app), 'סגירת הגרף מרעננת את ההתראות בכרטיס');
  const se = app.slice(app.indexOf('function stockAlertsEl'), app.indexOf('function refreshStockAlerts'));
  ok(!/innerHTML = [^'<]/.test(se) && /sub\.textContent = /.test(se), 'הערת ההתראה נכתבת כטקסט (לא HTML)');
  ok(/kcPriceAlerts: 'התראות מחיר'/.test(app) && /kcPriceAlerts: 'Price alerts'/.test(app) && /kcAlertNew: 'New price alert'/.test(app), 'מחרוזות המקטע בשתי השפות');
  ok(/\.st-al-row \{/.test(st) && /\.st-al-list \{[^}]*var\(--radius-sm\)/.test(st), 'עיצוב הרשימה — רדיוס ממשתנה');
}

/* ---------- שלב 0 במחקר המסחר: חיצי עסקאות וקו הממוצע (28/10/2026) — נתונים סינתטיים בלבד, לא עסקאות אמיתיות ---------- */
{
  const D = 86400000, bars = [0, 1, 2, 3, 4].map((i) => ({ timestamp: Date.UTC(2026, 0, 5 + i, 14, 30), open: 10, high: 12 + i, low: 8 - i * 0.1, close: 11, volume: 1 }));
  const day = (b) => Math.floor(b.timestamp / D), dk = (d) => Date.UTC(2026, 0, d) / D;
  const m = L.fillMarks(bars, [
    { k: dk(5), side: 'BUY', qty: 10, price: 10 }, { k: dk(5), side: 'BUY', qty: 5, price: 13 },   // שני ביצועים באותו נר → חץ אחד
    { k: dk(5), side: 'SELL', qty: 3, price: 12 },                                                 // מכירה באותו נר → חץ נפרד מעל
    { k: dk(7), side: 'SELL', qty: 2, price: 11 },
    { k: dk(1), side: 'BUY', qty: 1, price: 1 }, { k: dk(20), side: 'BUY', qty: 1, price: 1 },     // מחוץ לטווח — לא מוצגים
    { k: dk(6), side: 'BUY', qty: 0, price: 1 },                                                  // כמות 0 — לא מוצג
  ], day, 2);
  ok(m.length === 3, 'חיצים: שלושה (סכום באותו נר, מכירה בנפרד, מחוץ לטווח ו־0 בחוץ)');
  ok(m[0].buy && m[0].i === 0 && m[0].qty === 15 && m[0].n === 2 && near(m[0].price, 11) && m[0].value === bars[0].low, 'קנייה: סכום כמות, ממוצע משוקלל, מתחת לנר (הנמוך)');
  ok(!m[1].buy && m[1].i === 0 && m[1].qty === 3 && m[1].value === bars[0].high, 'מכירה: מעל הנר (הגבוה)');
  ok(m[2].i === 2 && m[2].timestamp === bars[2].timestamp, 'הביצוע נקשר לנר שלו');
  // טווח גדול (שבועי): ביצוע באמצע השבוע → לנר שמתחיל לפניו
  const wk = [0, 1, 2].map((i) => ({ timestamp: Date.UTC(2026, 0, 5 + 7 * i), open: 1, high: 2, low: 0.5, close: 1, volume: 1 }));
  const w = L.fillMarks(wk, [{ k: dk(14), side: 'BUY', qty: 4, price: 1 }, { k: dk(24), side: 'SELL', qty: 1, price: 1 }, { k: dk(30), side: 'BUY', qty: 1, price: 1 }], day, 8);
  ok(w.length === 2 && w[0].i === 1 && w[1].i === 2 && !w[1].buy, 'שבועי: הביצוע מתיישר לנר שמכיל אותו, אחרי הנר האחרון — לא מוצג');
  // תוך־יומי לפי זמן במ"ש
  const mb = [0, 1, 2].map((i) => ({ timestamp: Date.UTC(2026, 0, 5, 14, 30 + 5 * i), open: 1, high: 2, low: 0.5, close: 1, volume: 1 }));
  const mi = L.fillMarks(mb, [{ k: Date.UTC(2026, 0, 5, 14, 37), side: 'BUY', qty: 2, price: 1 }, { k: Date.UTC(2026, 0, 5, 14, 46), side: 'BUY', qty: 2, price: 1 }], (b) => b.timestamp, 300000);
  ok(mi.length === 1 && mi[0].i === 1, 'תוך־יומי: 14:37 בנר של 14:35; אחרי סוף הנר האחרון — לא מוצג');
  ok(L.fillMarks([], [{ k: 1, side: 'BUY', qty: 1 }], day, 1).length === 0 && L.fillMarks(bars, null, day, 1).length === 0, 'בלי נרות / בלי עסקאות — ריק');

  const ch = fs.readFileSync(path.join(root, 'chart.js'), 'utf8'), app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  ok(/name: 'kcFill'/.test(ch) && /groupId: 'fills', lock: true/.test(ch), 'אוברליי kcFill נעול בקבוצה fills');
  ok(/name: 'kcPos'/.test(ch) && /createYAxisFigures/.test(ch.split("name: 'kcPos'")[1].split('R({')[0]) && /groupId: 'pos', lock: true/.test(ch), 'קו הממוצע kcPos עם תווית בציר');
  ok(/\(live - p\.avg\) \* p\.n/.test(ch) && /POSC\.up : POSC\.dn/.test(ch), 'רווח/הפסד חי = (מחיר − ממוצע) × כמות, ירוק/אדום');
  ok(/drawFills\(c\); drawPos\(c\);\n  if \(c\.fit\)/.test(ch) && /drawExt\(c\); drawFills\(c\); drawPos\(c\);/.test(ch), 'מצוירים אחרי טעינה ובכל מחיר חי');
  ok(/fills: g\.fills === 0 \? 0 : 1/.test(ch) && /toggle\(T\('kcFills'\), g\.fills !== 0/.test(ch), 'מתג בהגדרות, ברירת מחדל דלוק');
  ok(/c\.extKey = null; c\.fillKey = null; c\.posKey = null; c\.fx = null;/.test(ch), 'החלפת מניה/טווח — מחשב מחדש');
  ok(/fills: \(sym\) => chartFills\(sym\)/.test(app) && /function chartFills\(sym\)/.test(app) && /mtActiveTrades\(\)/.test(app.split('function chartFills')[1].slice(0, 1500)), 'app.js מעביר עסקאות (IBKR + ידניות) ואחזקה');
  ok(/kcFills: 'העסקאות שלי וקו הממוצע'/.test(app) && /kcFills: 'My trades and average line'/.test(app) && /kcPosTag: '\{n\} מניות · ממוצע \{p\}'/.test(app) && /kcPosTag: '\{n\} sh · avg \{p\}'/.test(app), 'מחרוזות בשתי השפות');
  ok(!/fetch\(|E\.api\(/.test(ch.split('function fillsOf')[1].split('function redrawMine')[0]), 'בלי שום בקשת רשת — רק נתונים שכבר באפליקציה');
}

console.log('\n' + n + ' בדיקות עברו');
