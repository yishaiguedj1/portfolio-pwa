// כלי בדיקת העומק של מכפיל באפט (tools/buffett-deep/, docs/buffett-pe-audit.md): הכלים עצמם נבדקים — כלי בדיקה שגוי = ביטחון שקרי.
// model.js (analysis.js עצמו, לפי רבעון) מול indep.py (המימוש העצמאי בפייתון) ב־compare.py, על חברות סינתטיות בכל המצבים:
// מוציא / כולל / מעורב / לא ידוע / רחוב = GAAP / null / "עכשיו" = השנה / מחיר חי. וגם prtext.py (הטבלאות נשמרות שורה־שורה).
// בלי רשת: קבצים זמניים בלבד. הרצה: node tests/buffett-deep.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

let n = 0;
const ok = (c, name) => { n++; assert(c, name); console.log('ok -', name); };
const root = path.join(__dirname, '..');
const T = path.join(root, 'tools', 'buffett-deep');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'buffett-deep-'));
const snapD = path.join(tmp, 'snap');
fs.mkdirSync(snapD);

// חברה סינתטית (כמו ב־tests/buffett-pe.test.js): 6 שנים + רבעון בשנה הפתוחה; רווח 20%, מס 20%, תגמול 2% מההכנסות
const fy = ['2020-12-31', '2021-12-31', '2022-12-31', '2023-12-31', '2024-12-31', '2025-12-31'];
const rev = [100, 110, 121, 133, 146, 161].map((x) => x * 1e9);
const A0 = { rev, op: rev.map((x) => x * 0.25), ni: rev.map((x) => x * 0.2), pretax: rev.map((x) => x * 0.25), tax: rev.map((x) => x * 0.05),
  eps: rev.map((x) => x * 0.2 / 1e9), sh: fy.map(() => 1e9), ocf: rev.map((x) => x * 0.3), capex: rev.map((x) => x * 0.08), sbc: rev.map((x) => x * 0.02),
  dep: rev.map((x) => x * 0.05), cash: fy.map(() => 30e9), debt: fy.map(() => 20e9), eq: rev.map((x) => x * 0.9) };
const INST = new Set(['cash', 'debt', 'eq', 'sh']);
function company(extraQ) {
  const q = [], Q = {};
  for (const k in A0) Q[k] = [];
  fy.forEach((e, i) => ['03-31', '06-30', '09-30', '12-31'].forEach((md) => { q.push(e.slice(0, 4) + '-' + md); for (const k in A0) Q[k].push(INST.has(k) ? A0[k][i] : A0[k][i] / 4); }));
  if (extraQ) { q.push('2026-03-31'); for (const k in A0) Q[k].push(INST.has(k) ? A0[k][5] : A0[k][5] / 4 * 1.1); }
  return { q, Q };
}
const rel = (e, ex, fut = ex, days = 30) => [new Date(Date.parse(e) + days * 864e5).toISOString().slice(0, 10), ex, fut, 5000];
function snap(sym, o) {
  const { q, Q } = company(o.extraQ !== false);
  const L = q.length - 1, last4 = [L - 3, L - 2, L - 1, L];
  const hist = o.hist === null ? [] : last4.map((i, j) => ({ q: q[i], a: Q.eps[i] + (typeof o.d === 'function' ? o.d(j) : o.d ?? 1), e: Q.eps[i] }));
  const sbcX = o.pol ? last4.map((i, j) => rel(q[i], o.pol[j], o.fut ? o.fut[j] : o.pol[j])) : [];
  const d = { ok: true, sym, src: 'sec', cur: 'USD', fy, q, A: A0, Q, T: null, prof: { name: sym }, price: 400, sharesOut: 1e9, fpe: o.fpe ?? 18,
    est: [{ p: '+1y', eps: 42, n: 9, rev: 190e9, rn: 9, end: '2027-12-31' }], indData: {}, checks: [], fill: [], hist, sbcX };
  fs.writeFileSync(path.join(snapD, sym + '.json'), JSON.stringify(d));
}
snap('EXA', { pol: [1, 1, 1, 1] });                       // מוציא בכל הרבעונים
snap('INC', { pol: [0, 0, 0, 0] });                       // כולל
snap('MIX', { pol: [1, 1, 0, 0] });                       // שינה מדיניות
snap('CHG', { pol: [1, 1, 1, 1], fut: [1, 1, 1, 0] });    // ההודעה האחרונה: "מעכשיו כולל"
snap('UNK', { d: (j) => [0.01, 0.5, 2, 0.3][j] });        // בלי הודעות — עד גובה הפער
snap('YGA', { pol: [1, 1, 1, 1], d: (j) => (j === 2 ? 0.4 : 0.01) }); // רחוב = GAAP ב־3 מ־4
snap('NOH', { pol: [1, 1, 1, 1], hist: null });           // אין רחוב → null
snap('ANN', { pol: [1, 1, 1, 1], extraQ: false });        // הרבעון האחרון = סוף השנה → "עכשיו" = השנה

const run = (args) => spawnSync(process.execPath, [path.join(T, 'model.js'), ...args], { encoding: 'utf8' });
const mOut = path.join(tmp, 'm.jsonl'), iOut = path.join(tmp, 'i.jsonl');
let r = run(['--snap', snapD, '--out', mOut]);
ok(r.status === 0, 'model.js: כל החברות — הסכומים לפי רבעון שווים ל־bufCalc');
const M = Object.fromEntries(fs.readFileSync(mOut, 'utf8').trim().split('\n').map(JSON.parse).map((o) => [o.sym, o]));
ok(M.EXA.buf.pol === 'ex' && M.EXA.rows.every((x) => x.pol === 1 && x.ded === x.sbAt && x.polBy.how === 'win'), 'מוציא: כל התגמול בכל רבעון, ההודעה מהחלון');
ok(M.INC.buf.ded === 0 && M.INC.note === 'anBPolIn', 'כולל: אין ניכוי, ההערה "כולל"');
ok(M.MIX.buf.pol === 'mix' && M.MIX.rows[2].ded === 0 && M.MIX.rows[0].ded > 0, 'מעורב: הניכוי רק ברבעונים שמוציאים');
ok(M.CHG.buf.f.chg === true && M.CHG.buf.f.ded === 0 && M.CHG.noteF === 'anBFutIn', '"מעכשיו כולל": בלי ניכוי צפוי, ההערה בצפוי');
ok(M.UNK.buf.pol === '?' && Math.abs(M.UNK.rows[0].ded - 0.01) < 1e-9 && M.UNK.rows[2].ded === M.UNK.rows[2].sbAt, 'לא ידוע: עד גובה הפער, ולא יותר מהתגמול');
ok(M.YGA.buf.yGaap && M.YGA.buf.ded === 0, 'רחוב = GAAP ב־3 מ־4: אין ניכוי גם כשמוציא');
ok(M.NOH.buf === null && /^no-hist:/.test(M.NOH.why), 'אין רחוב → null עם סיבה');
ok(M.ANN.now.kind === 'fy' && M.ANN.buf, '"עכשיו" = השנה האחרונה — מחושב');
ok(M.EXA.inv.bpe && Math.abs(M.EXA.inv.bpe.back - M.EXA.inv.bpe.m11) < 1e-9, 'עריכת מחיר: מכפיל → מחיר → אותו מכפיל');

const py = (f, args) => spawnSync('python3', ['-I', path.join(T, f), ...args], { encoding: 'utf8' });
r = py('indep.py', [snapD, iOut]);
ok(r.status === 0, 'indep.py רץ');
r = py('compare.py', [mOut, iOut]);
ok(r.status === 0, 'המימוש העצמאי זהה ל־analysis.js בכל הערכים: ' + (r.stdout.split('\n')[0] || ''));
// מחיר חי: המכפיל הצפוי של Yahoo עובר למחיר החי בשניהם
const mOut2 = path.join(tmp, 'm2.jsonl'), iOut2 = path.join(tmp, 'i2.jsonl');
ok(run(['--snap', snapD, '--out', mOut2, '--px', '1.1']).status === 0 && py('indep.py', [snapD, iOut2, '--px', '1.1']).status === 0, 'מחיר חי מדומה — שניהם רצים');
r = py('compare.py', [mOut2, iOut2]);
ok(r.status === 0, 'מחיר חי: זהים');
const m2 = Object.fromEntries(fs.readFileSync(mOut2, 'utf8').trim().split('\n').map(JSON.parse).map((o) => [o.sym, o]));
ok(Math.abs(m2.EXA.tiles.fpe - 18 * 1.1) < 1e-9 && Math.abs(m2.EXA.tiles.bpe / M.EXA.tiles.bpe - 1.1) < 1e-9, 'מחיר חי: המכפיל הצפוי והמכפיל של באפט זזים ביחס למחיר');
// הבודק עצמו תופס פער: משנים ערך אחד בפלט העצמאי
const bad = fs.readFileSync(iOut, 'utf8').trim().split('\n').map(JSON.parse);
bad.find((o) => o.sym === 'EXA').rows[1].ded += 0.01;
fs.writeFileSync(path.join(tmp, 'bad.jsonl'), bad.map((o) => JSON.stringify(o)).join('\n') + '\n');
r = py('compare.py', [mOut, path.join(tmp, 'bad.jsonl')]);
ok(r.status === 1 && /q1\.ded/.test(r.stdout), 'compare.py תופס פער של סנט ברבעון אחד');

// prtext.py: הטבלה נשמרת — שורת התגמול ושורת היעד, התאים מופרדים
const BD = path.join(tmp, 'bd'), acc = '0000000000-26-000001', dir = path.join(BD, 'cache', 'www.sec.gov', 'Archives', 'edgar', 'data', '1', acc.replace(/-/g, ''));
fs.mkdirSync(dir, { recursive: true }); fs.mkdirSync(path.join(BD, 'pr'));
fs.writeFileSync(path.join(dir, 'ex99.htm'), '<html><body><p>Results for the three months ended September 30</p><table><tr><td>Stock-based compensation</td><td>$</td><td>630</td><td>(</td><td>492</td><td>)</td></tr>' +
  '<tr><td>Non-GAAP net income per share - diluted</td><td>1.00</td></tr></table><script>x=1</script></body></html>');
fs.writeFileSync(path.join(BD, 'pr', '1.json'), JSON.stringify({ sym: 'TST', cik: 1, items: [{ acc, filed: '2026-10-28', form: '8-K', items: '2.02', got: ['ex99.htm'] }] }));
execFileSync('python3', ['-I', path.join(T, 'prtext.py')], { env: { ...process.env, BD_DIR: BD } });
const txt = fs.readFileSync(path.join(BD, 'prt', '1', acc + '.txt'), 'utf8');
ok(/^Stock-based compensation \| 630 \| \(492\)$/m.test(txt) && /^Non-GAAP net income per share - diluted \| 1\.00$/m.test(txt) && !/x=1/.test(txt), 'prtext.py: שורות הטבלה, התאים וסוגריים — בלי סקריפט');

// xbrl.py: החילוץ העצמאי מ־companyfacts — ישיר (3 חודשים), הפרש מצטבר, שנה פחות 9 חודשים; רווח למניה ברבעון הרביעי —
// אין ערך (לא חיבורי) והקירוב רווח ÷ מניות; frame של SEC; ופער אחד שמתגלה
{
  const XB = path.join(tmp, 'xb'), sd = path.join(XB, 'snap');
  fs.mkdirSync(sd, { recursive: true });
  const ends = ['2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31'], st = '2025-01-01';
  const f = (start, end, val, form = '10-Q', filed = '2026-01-20') => ({ start, end, val, accn: '0000000009-26-000001', form, filed });
  const facts = { facts: { 'us-gaap': {
    ShareBasedCompensation: { units: { USD: [f(st, ends[0], 100), f(st, ends[1], 210), f(st, ends[2], 330), f(st, ends[3], 460, '10-K')] } },
    EarningsPerShareDiluted: { units: { 'USD/shares': [f(st, ends[0], 1.0), f('2025-04-01', ends[1], 1.1), f('2025-07-01', ends[2], 1.2), f(st, ends[3], 4.6, '10-K')] } },
    NetIncomeLoss: { units: { USD: [f(st, ends[0], 1000), f('2025-04-01', ends[1], 1100), f('2025-07-01', ends[2], 1200), f(st, ends[3], 4600, '10-K')] } },
  } } };
  const fd = path.join(XB, 'cache', 'data.sec.gov', 'api', 'xbrl', 'companyfacts');
  fs.mkdirSync(fd, { recursive: true });
  fs.writeFileSync(path.join(fd, 'CIK0000000009.json'), JSON.stringify(facts));
  const fr = path.join(XB, 'cache', 'data.sec.gov', 'api', 'xbrl', 'frames', 'us-gaap', 'EarningsPerShareDiluted', 'USD-per-shares');
  fs.mkdirSync(fr, { recursive: true });
  fs.writeFileSync(path.join(fr, 'CY2025Q3.json'), JSON.stringify({ data: [{ cik: 9, val: 1.2, end: ends[2], accn: 'x' }] }));
  const Q = { sbc: [100, 110, 120, 131], eps: [1.0, 1.1, 1.2, 1.3], ni: [1000, 1100, 1200, 1300], sh: [1000, 1000, 1000, 1000] };
  fs.writeFileSync(path.join(sd, 'XBR.json'), JSON.stringify({ ok: true, src: 'sec', sym: 'XBR', cik: 9, q: ends, Q,
    tags: { sbc: 'ShareBasedCompensation', eps: 'EarningsPerShareDiluted', ni: 'NetIncomeLoss' } }));
  const xo = path.join(XB, 'x.jsonl');
  execFileSync('python3', ['-I', path.join(T, 'xbrl.py'), sd, xo], { env: { ...process.env, BD_DIR: XB } });
  const X = fs.readFileSync(xo, 'utf8').trim().split('\n').map(JSON.parse);
  const g = (e, c) => X.find((r) => r.e === e && r.c === c);
  ok(g(ends[0], 'sbc').same.how === 'q' && g(ends[1], 'sbc').same.how === 'ytd' && g(ends[1], 'sbc').same.last === 110 && g(ends[3], 'sbc').same.how === 'fy-9m',
    'xbrl.py: ישיר / הפרש מצטבר / שנה פחות 9 חודשים');
  ok(g(ends[3], 'sbc').ok === false && g(ends[2], 'sbc').ok === true, 'xbrl.py: פער ברבעון הרביעי (131 מול 130) מתגלה, רבעון תקין עובר');
  ok(!g(ends[3], 'eps').same && g(ends[3], 'eps').why === 'q4-approx' && Math.abs(g(ends[3], 'eps').approx - 1.3) < 1e-9, 'xbrl.py: רווח למניה ברבעון הרביעי — בלי הפרש, רק הקירוב');
  ok(g(ends[2], 'eps').frame && g(ends[2], 'eps').frame.v === 1.2 && g(ends[2], 'eps').frame.frame === 'CY2025Q3', 'xbrl.py: ה־frame של SEC לרבעון הקלנדרי');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${n} בדיקות עברו`);
