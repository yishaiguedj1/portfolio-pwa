// כלי בדיקת העומק של גרף הנרות (tools/chart-deep/, docs/chart-deep-audit.md): הכלים עצמם נבדקים —
// צילום השרתון כמו הטלפון (עמודים, to, 502 בקצה ההיסטוריה), מודל התצוגה (fetchOlder + aggregate), ההשוואה (בדיקה עצמית בפייתון),
// והמושכים (מפתח יומי, בלי כפילויות). בלי רשת: fetch מדומה, קבצים זמניים.
// הרצה: node tests/chart-deep.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

let n = 0;
const ok = (c, name) => { n++; assert(c, name); console.log('ok -', name); };
const root = path.join(__dirname, '..');
const T = path.join(root, 'tools', 'chart-deep');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chart-deep-'));
process.env.CHART_DEEP_BACKOFF = '5';

(async () => {
  /* ---------- snap.js: עמודים כמו fetchOlder, ו־502 בעמוד ישן נרשם כממצא ---------- */
  const calls = [];
  const page = (t, more) => ({ ok: true, iv: '1m', t, o: t.map(() => 10), h: t.map(() => 11), l: t.map(() => 9), c: t.map(() => 10), v: t.map(() => 1), tz: 'America/New_York', cur: 'USD', ex: 'NMS', name: 'X', more });
  global.fetch = async (url, opt) => {
    const b = JSON.parse(opt.body);
    calls.push(b);
    const r = !b.to ? page([1200, 1260, 1320], true) : b.to === 1200 ? page([1080, 1140, 1200], true) : null;
    if (!r) return { status: 502, ok: false, text: async () => '{"ok":false,"error":"upstream"}' };
    return { status: 200, ok: true, text: async () => JSON.stringify(r) };
  };
  const { snapSeries } = require(path.join(T, 'snap.js'));
  const k = await snapSeries(tmp, 'TST', '1m', 0, { pages: 9, rate: 60000, refresh: true });
  const dir = path.join(tmp, 'snap', 'TST');
  ok(calls[0].to === undefined && calls[1].to === 1200 && calls[2].to === 1080, 'snap: to = הנר הראשון שכבר נטען (כמו fetchOlder)');
  ok(calls.length === 4 && k === 2, 'snap: 502 בעמוד ישן — 2 ניסיונות ואז עצירה (לא 5)');
  const p2 = JSON.parse(fs.readFileSync(path.join(dir, '1m.0.p2.json'), 'utf8'));
  ok(p2.res.ok === false && p2.res.status === 502, 'snap: עמוד ישן שנכשל נרשם (C-001)');

  /* ---------- model.js: חיבור העמודים + צבירה, endErr ---------- */
  const m = require(path.join(T, 'model.js'));
  const lib = m.loadLib();
  const b = m.buildRaw(lib.L, dir, '1m', 0);
  ok(JSON.stringify(b.raw.map((x) => x.timestamp / 1000)) === '[1080,1140,1200,1260,1320]', 'model: נרות העמוד הישן מחוברים מלפנים בלי כפילות (< הנר הראשון)');
  ok(b.meta.endErr === 'upstream' && b.meta.at > 0, 'model: endErr וזמן הצילום נשמרים');
  ok(m.modelSym(lib, tmp, 'TST') >= 2, 'model: קבצי תצוגה נכתבו');
  const d3 = JSON.parse(fs.readFileSync(path.join(tmp, 'disp', 'TST', '3m.0.json'), 'utf8'));
  ok(d3.base === '1m' && d3.bars.length === 2 && d3.bars[0][2] === 11, 'model: 3m מצורף מ־1m');

  /* ---------- compare.py: הבדיקה העצמית (עוגנים, שעון קיץ, פיצול, פסיקות, יום מקוצר, כפילות חודש) ---------- */
  const st = execFileSync('python3', ['-I', path.join(T, 'compare.py'), '--selftest'], { encoding: 'utf8' });
  ok(/selftest: תקין/.test(st), 'compare: בדיקה עצמית');
  const lb = execFileSync('python3', ['-I', path.join(T, 'layerb.py'), '--selftest'], { encoding: 'utf8' });
  ok(/selftest: תקין/.test(lb), 'layerb: בדיקה עצמית (יומי מול Webull לפי סוג, עקביות שבועי/חודשי מול היומי, יום תחילת השבוע)');

  /* ---------- ind.py (גל 5): המחוונים לפי ההגדרות המקובלות — בדיקה עצמית על דוגמאות שחושבו ביד ---------- */
  const it = execFileSync('python3', ['-I', path.join(T, 'ind.py'), '--selftest'], { encoding: 'utf8' });
  ok(/selftest: כל הבדיקות עברו/.test(it), 'ind: בדיקה עצמית');

  /* ---------- sources.py: מפתח יומי ושמירה בלי כפילויות ---------- */
  const py = execFileSync('python3', ['-I', '-c', [
    'import sys, json, os', 'sys.path.insert(0, sys.argv[1])', 'import sources as S',
    'out = sys.argv[2]',
    'n = S.save(out, "x", "TST", "1d", [[3, 1, 1, 1, 1, 0], [1, 1, 1, 1, 1, 0], [3, 2, 2, 2, 2, 0]], tz="UTC")',
    'r = json.load(open(os.path.join(out, "src", "x", "TST", "1d.json")))',
    'print(json.dumps([n, [b[0] for b in r["bars"]], S.day_t("2026-11-16"), S.nyd(1794787200 + 3 * 3600)]))',
  ].join('\n'), T, tmp], { encoding: 'utf8' });
  const [cnt, ts, dt, ny] = JSON.parse(py);
  ok(cnt === 2 && JSON.stringify(ts) === '[1,3]', 'sources: שמירה ממוינת בלי כפילויות זמן');
  ok(dt === Date.UTC(2026, 10, 16) / 1000, 'sources: day_t = חצות UTC של התאריך');
  ok(ny === '2026-11-15', 'sources: nyd — התאריך בניו יורק (03:00 UTC = הערב הקודם)');

  /* ---------- live.js + livecheck.js: הקלטה חיה מורצת דרך onQuote/applyTick/mergeBars ---------- */
  const LV = require(path.join(T, 'live.js'));
  const sq = LV.slimQuote({ chart: { result: [{ meta: { regularMarketPrice: 10, regularMarketTime: 1030, regularMarketVolume: 100, currency: 'USD' } }] }, x: { state: 'REGULAR', reg: { p: 10, t: 1030 } } });
  ok(sq.m.v === 100 && sq.x.st === 'REGULAR' && sq.x.reg.p === 10 && sq.x.pre === null, 'live: הרשומה המצומצמת שומרת את מה ש־parseQuote קורא');
  const LC = require(path.join(T, 'livecheck.js'));
  const snap = (at, t, v) => ({ at: at * 1000, tz: 'UTC', t, o: t.map(() => 10), h: t.map(() => 11), l: t.map(() => 9), c: t.map(() => 10), v });
  const quote = (at, p, vol) => ({ at: at * 1000, d: { X: { m: { p, t: at, v: vol, cur: 'USD' }, x: { st: 'REGULAR', reg: { p, t: at } } } } });
  const snaps = [snap(1030, [960, 1020], [50, 0]), snap(1055, [960, 1020], [50, 0]), snap(1130, [1020, 1080], [70, 0])];
  const qs = [quote(1031, 10.5, 100), quote(1040, 10.6, 130), quote(1050, 10.7, 150), quote(1060, 10.8, 160), quote(1085, 10.2, 200), quote(1090, 10.1, 210)];
  const sim = LC.simulate(lib.L, qs, snaps, 'X', '1m', 0);
  ok(sim.kinds.added === 1 && sim.resets === 0, 'livecheck: נר חדש מ־applyTick בגבול הדקה, בלי איפוס');
  ok(sim.fixAtReconcile.n === 2 && sim.fixAtReconcile.v0 === 2, 'livecheck: נפח 0 של הדקה החיה בשרתון מזוהה (C-014)');
  const off = LC.simulate(lib.L, qs, [snap(1030, [960, 1020], [50, 0]), snap(1100, [990, 1050], [50, 40])], 'X', '1m', 0);
  ok(off.resets === 1, 'livecheck: רענון עם רשת אחרת = איפוס (resetData)');
  // C-025: רענון בשניות הראשונות של דקה חדשה — Yahoo עוד לא החזיר אותה, mergeBars מוחק את הנר החי → איפוס
  const lag = LC.simulate(lib.L, [quote(1085, 10.2, 200)], [snap(1030, [960, 1020], [50, 0]), snap(1086, [960, 1020], [50, 40])], 'X', '1m', 0, { from: 1084e3, to: 1090e3 });
  ok(lag.kinds.added === 1 && lag.resets === 1 && lag.trace.map((x) => x.ev).join() === 'added,refresh-reset', 'livecheck: נר חי שנמחק ברענון (C-025) + מעקב אירועים');
  // C-008 בזמן אמת: הסגירה הרשמית בחותמת 1 שנייה אחרי סוף הנר האחרון — onQuote לא מחיל אותה
  const qp = (at, p, t) => ({ at: at * 1000, d: { X: { m: { p, t, v: 0, cur: 'USD' }, x: { st: 'POST', reg: { p, t } } } } });
  const one = [snap(1030, [960, 1020], [50, 0])];
  ok(LC.simulate(lib.L, [qp(1082, 10.4, 1080)], one, 'X', '1m', 0).kinds['close-fix'] === 1 && LC.simulate(lib.L, [qp(1082, 10.4, 1081)], [snap(1030, [960, 1020], [50, 0])], 'X', '1m', 0).kinds.idle === 1,
    'livecheck: תיקון הסגירה חל רק עד סוף הנר (16:00:00), לא על חותמת 16:00:01');

  /* ---------- kcverify.js: המודל מאותן תשובות כמו הגרף (fetchInit מאפס, fetchOlder לפי to) ---------- */
  const KV = require(path.join(T, 'kcverify.js'));
  const cols = (t) => ({ ok: true, t, o: t.map(() => 1), h: t.map(() => 2), l: t.map(() => 0.5), c: t.map(() => 1.5), v: t.map(() => 10) });
  const klog = [
    { body: { sym: 'X', iv: '1m' }, res: cols([1200, 1260]) },
    { body: { sym: 'X', iv: '1m', to: 1200 }, res: cols([1080, 1140, 1200]) },
    { body: { sym: 'X', iv: '1m' }, res: cols([1260, 1320]) },          // מרווח חדש — מתחילים מחדש
    { body: { sym: 'X', iv: '1m', to: 1080 }, res: cols([1020]) },        // לא שייך לסדרה הנוכחית — מדולג
  ];
  const km = KV.model(lib.L, lib.TF, klog, 'X', '1m');
  ok(JSON.stringify(km.map((b) => b.timestamp / 1000)) === '[1260,1320]', 'kcverify: fetchInit חדש מאפס, עמוד ישן רק לפי הנר הראשון');
  const kc = KV.compare([{ timestamp: 1260e3, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }, { timestamp: 1290e3, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }], km);
  ok(kc.same === 1 && kc.onlyShown === 1 && kc.onlyModel === 1 && kc.near.shown.length === 2, 'kcverify: השוואה — זהים, רק במסך, רק במודל, וסביבת ההבדל');

  /* ---------- summary.py: סיכום לפי סמל מקבצי ההשוואה ---------- */
  fs.mkdirSync(path.join(tmp, 'sum', 'cmp'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'sum', 'cmp', 'X.json'), JSON.stringify({ sym: 'X', cls: 'us', xcal: { '1W': { n: 5, exp: 4 }, '1M': { n: 3, exp: 3, miss: 2 } }, tfs: {
    '1D.0': { n: 10, src: { v: { V3: 7, V2: 1, MIX: 0, DIFF: 2, 'DIFF?': 0, NOSRC: 0 }, srcs: [['webull', '1d', 10]] }, align: { off: 0 }, inv: { dup: 0, jump: 1, unit: 1 } },
    '1W.0': { n: 5, src: { v: { V3: 0, V2: 5, MIX: 0, DIFF: 0, 'DIFF?': 0, NOSRC: 0 } }, align: { wday: 5 }, inv: {} } } }));
  const sm = execFileSync('python3', ['-I', path.join(T, 'summary.py'), '--out', path.join(tmp, 'sum')], { encoding: 'utf8' });
  ok(/^X\s+us\s+n=15\s+V3=7 V2=6 MIX=0 DIFF=2/.test(sm) && /WD=5/.test(sm) && /UNIT=1/.test(sm) && /xcal 1W 4\/5 1M 3\/3 חסרים 2/.test(sm) && /1D\.0:2/.test(sm), 'summary: סכום הפסיקות, WD, UNIT, xcal (כולל חסרים) והמרווח עם DIFF');

  /* ---------- compare.py xcal: חודש שיש בו ימי מסחר ואין לו נר חודשי (חוזים: 46 חודשים חסרים) ---------- */
  const xd = path.join(tmp, 'xc', 'disp', 'X');
  fs.mkdirSync(xd, { recursive: true });
  const ut = (m, d, h) => Date.UTC(2020, m, d, h) / 1000;
  const dayBars = [];
  for (let m = 0; m < 6; m++) for (const d of [2, 15]) dayBars.push([ut(m, d, 14), 10, 11, 9, 10, 1]);
  const monBars = [0, 1, 3, 4, 5].map((m) => [ut(m, 1, 5), 10, 11, 9, 10, 2]);
  fs.writeFileSync(path.join(xd, '1D.0.json'), JSON.stringify({ tz: 'America/New_York', at: Date.UTC(2026, 10, 16), bars: dayBars }));
  fs.writeFileSync(path.join(xd, '1M.0.json'), JSON.stringify({ tz: 'America/New_York', at: Date.UTC(2026, 10, 16), bars: monBars }));
  const xc = JSON.parse(execFileSync('python3', ['-I', '-c', [
    'import sys, json', 'sys.path.insert(0, sys.argv[1])', 'import compare as C',
    'r = C.xcal(sys.argv[2], "X", "us")', 'print(json.dumps(r["1M"]))',
  ].join('\n'), T, path.join(tmp, 'xc')], { encoding: 'utf8' }));
  ok(xc.miss === 1 && JSON.stringify(xc.ex_miss) === '["2020-03"]', 'compare: xcal — חודש עם ימי מסחר ובלי נר חודשי נספר כחסר');

  /* ---------- compare.py xday: בחוזים יום המסחר מתחיל ב־18:00 של הערב הקודם ---------- */
  const fd = path.join(tmp, 'xc', 'disp', 'Y=F');
  fs.mkdirSync(fd, { recursive: true });
  const nyt = (d, h, mi) => Date.UTC(2026, 10, d, h + 5, mi) / 1000;   // נובמבר אחרי שעון חורף: ניו יורק = UTC-5
  const fm = [];
  for (const [d, h0, h1] of [[15, 18, 23], [16, 0, 16], [16, 18, 23], [17, 0, 16]]) for (let h = h0; h <= h1; h++) fm.push([nyt(d, h, 0), 100 + h, 101 + h, 99 + h, 100.5 + h, 1]);
  const fday = (a, b) => { const x = fm.filter((r) => r[0] >= a && r[0] < b); return [x[0][1], Math.max(...x.map((r) => r[2])), Math.min(...x.map((r) => r[3])), x[x.length - 1][4], x.length]; };
  const fD = [[nyt(16, 0, 0), ...fday(nyt(15, 18, 0), nyt(16, 17, 0))], [nyt(17, 0, 0), ...fday(nyt(16, 18, 0), nyt(17, 17, 0))]];
  fs.writeFileSync(path.join(fd, '1D.0.json'), JSON.stringify({ tz: 'America/New_York', at: Date.UTC(2026, 10, 19), bars: fD }));
  fs.writeFileSync(path.join(fd, '1h.0.json'), JSON.stringify({ tz: 'America/New_York', at: Date.UTC(2026, 10, 19), bars: fm }));
  const xf = JSON.parse(execFileSync('python3', ['-I', '-c', [
    'import sys, json', 'sys.path.insert(0, sys.argv[1])', 'import compare as C',
    'r = C.xday(sys.argv[2], "Y=F", "fut", "America/New_York")', 'print(json.dumps(r["1h"]))',
  ].join('\n'), T, path.join(tmp, 'xc')], { encoding: 'utf8' }));
  ok(xf.days === 2 && xf.o === 2 && xf.c === 2 && xf.only_i === 0, 'compare: xday בחוזים — יום המסחר 18:00–17:00 (לא יום קלנדרי)');

  /* ---------- היגיינה: בלי מפתחות, בלי שם מוצר הייחוס ---------- */
  const all = ['snap.js', 'model.js', 'sources.py', 'compare.py', 'live.js', 'livecheck.js', 'kcverify.js', 'ind.py', 'summary.py'].map((f) => fs.readFileSync(path.join(T, f), 'utf8')).join('\n');
  ok(!/api_token=(?!demo)[A-Za-z0-9]{6,}|apikey=(?!demo)[A-Za-z0-9]{6,}/.test(all), 'אין מפתח אמיתי בכלים (רק מפתחות ההדגמה הציבוריים)');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
