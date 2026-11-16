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

  /* ---------- היגיינה: בלי מפתחות, בלי שם מוצר הייחוס ---------- */
  const all = ['snap.js', 'model.js', 'sources.py', 'compare.py'].map((f) => fs.readFileSync(path.join(T, f), 'utf8')).join('\n');
  ok(!/api_token=(?!demo)[A-Za-z0-9]{6,}|apikey=(?!demo)[A-Za-z0-9]{6,}/.test(all), 'אין מפתח אמיתי בכלים (רק מפתחות ההדגמה הציבוריים)');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
