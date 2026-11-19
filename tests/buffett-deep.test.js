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
{ // לא ידוע (מ־#721): הפער של 12 החודשים פחות ההפחתה מרכישות, עד התגמול אחרי מס — כסכום, לא לפי רבעון
  const u = M.UNK.rows, gap = u.reduce((t, r) => t + r.hq.a - r.g - r.amz, 0), cap = u.reduce((t, r) => t + r.sbAt, 0);
  ok(M.UNK.buf.pol === '?' && Math.abs(M.UNK.buf.ded - Math.min(Math.max(gap, 0), cap)) < 1e-9 && M.UNK.buf.ded <= cap + 1e-12, 'לא ידוע: עד גובה הפער, ולא יותר מהתגמול');
}
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

// xbrl.py: הגשה שחסרה ב־companyfacts — מה־instance שלה (רק בלי ממד), וקירוב המניות ברבעון 4 (ימים כולל הקצוות)
{
  const XB = path.join(tmp, 'xi'), sd = path.join(XB, 'snap'), C = path.join(XB, 'cache', 'data.sec.gov');
  for (const d of [sd, path.join(C, 'api', 'xbrl', 'companyfacts'), path.join(C, 'submissions')]) fs.mkdirSync(d, { recursive: true });
  const k10 = '0000000008-26-000001', q10 = '0000000008-26-000002';
  const f = (start, end, val, form = '10-Q') => ({ start, end, val, accn: form === '10-K' ? k10 : '0000000008-25-000009', form, filed: form === '10-K' ? '2026-02-10' : '2025-11-01' });
  fs.writeFileSync(path.join(C, 'api', 'xbrl', 'companyfacts', 'CIK0000000008.json'), JSON.stringify({ facts: { 'us-gaap': {
    WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: [f('2025-01-01', '2025-03-31', 1010), f('2025-04-01', '2025-06-30', 1000),
      f('2025-07-01', '2025-09-30', 990), f('2025-01-01', '2025-12-31', 1000, '10-K')] } },
    // 9 חודשים מקוריים 900, מוצגים מחדש ב־11/2026 (אחרי הפרדה) 700, השנה 1,200 ב־10-K; ושנה "מלאה" שתויגה בטעות ב־10-Q ‏(200)
    IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest: { units: { USD: [f('2025-01-01', '2025-09-30', 900),
      { ...f('2025-01-01', '2025-09-30', 700), filed: '2026-11-01', accn: '0000000008-26-000003' }, f('2025-01-01', '2025-12-31', 1200, '10-K'),
      { ...f('2025-01-01', '2025-12-31', 200), filed: '2026-05-01', accn: '0000000008-26-000004' }] } },
    // מס: 9 חודשים בתג אחד, השנה בתג אחר (AKAM) — רק המאגר המאוחד מוצא את רבעון 4
    IncomeTaxExpenseBenefit: { units: { USD: [f('2025-01-01', '2025-09-30', 150)] } },
    IncomeTaxExpenseBenefitContinuingOperations: { units: { USD: [f('2025-01-01', '2025-12-31', 210, '10-K')] } } } } }));
  fs.writeFileSync(path.join(C, 'submissions', 'CIK0000000008.json'), JSON.stringify({ filings: { recent: { form: ['10-Q', '10-K'],
    accessionNumber: [q10, k10], filingDate: ['2026-05-01', '2026-02-10'], reportDate: ['2026-03-31', '2025-12-31'],
    primaryDocument: ['xin-20260331.htm', 'xin-20251231.htm'], isXBRL: [1, 1] } } }));
  const ip = path.join(XB, 'cache', 'www.sec.gov', 'Archives', 'edgar', 'data', '8', q10.replace(/-/g, ''));
  fs.mkdirSync(ip, { recursive: true });
  const per = '<xbrli:period><xbrli:startDate>2026-01-01</xbrli:startDate><xbrli:endDate>2026-03-31</xbrli:endDate></xbrli:period>';
  const ent = (seg) => '<xbrli:entity><xbrli:identifier scheme="http://www.sec.gov/CIK">0000000008</xbrli:identifier>' + seg + '</xbrli:entity>';
  fs.writeFileSync(path.join(ip, 'xin-20260331_htm.xml'), '<?xml version="1.0"?><xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" ' +
    'xmlns:us-gaap="http://fasb.org/us-gaap/2025" xmlns:xbrldi="http://xbrl.org/2006/xbrldi">' +
    '<xbrli:context id="c1">' + ent('') + per + '</xbrli:context>' +
    '<xbrli:context id="c2">' + ent('<xbrli:segment><xbrldi:explicitMember dimension="dei:LegalEntityAxis">x:SubMember</xbrldi:explicitMember></xbrli:segment>') + per + '</xbrli:context>' +
    '<xbrli:unit id="usd"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit><xbrli:unit id="sh"><xbrli:measure>xbrli:shares</xbrli:measure></xbrli:unit>' +
    '<xbrli:unit id="eps"><xbrli:divide><xbrli:unitNumerator><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unitNumerator>' +
    '<xbrli:unitDenominator><xbrli:measure>xbrli:shares</xbrli:measure></xbrli:unitDenominator></xbrli:divide></xbrli:unit>' +
    '<us-gaap:EarningsPerShareDiluted contextRef="c2" unitRef="eps" decimals="2">9.99</us-gaap:EarningsPerShareDiluted>' +
    '<us-gaap:EarningsPerShareDiluted contextRef="c1" unitRef="eps" decimals="2">0.77</us-gaap:EarningsPerShareDiluted>' +
    '<us-gaap:ShareBasedCompensation contextRef="c1" unitRef="usd" decimals="-3">50</us-gaap:ShareBasedCompensation>' +
    '<us-gaap:NetIncomeLoss contextRef="c1" unitRef="usd" decimals="-3">70</us-gaap:NetIncomeLoss>' +
    '<us-gaap:IncomeTaxExpenseBenefit contextRef="c1" unitRef="usd" decimals="-3">20</us-gaap:IncomeTaxExpenseBenefit></xbrli:xbrl>');
  const ends = ['2025-03-31', '2025-06-30', '2025-09-30', '2025-12-31', '2026-03-31'];
  fs.writeFileSync(path.join(sd, 'XIN.json'), JSON.stringify({ ok: true, src: 'sec', sym: 'XIN', cik: 8, asOf: '2026-11-19', q: ends,
    splitsUsed: [['2026-06-01', 10]],   // פיצול 1:10 אחרי כל ההגשות — המערכת מתאימה להיום
    Q: { eps: [null, null, null, null, 0.77], sbc: [null, null, null, null, 50], sh: [10100, 10000, 9900, 10000, null], pretax: [null, null, null, 300, null] },
    tags: { eps: 'EarningsPerShareDiluted', sbc: 'ShareBasedCompensation', sh: 'WeightedAverageNumberOfDilutedSharesOutstanding',
      pretax: 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest' } }));
  const xo = path.join(XB, 'x.jsonl');
  execFileSync('python3', ['-I', path.join(T, 'xbrl.py'), sd, xo], { env: { ...process.env, BD_DIR: XB } });
  const X = fs.readFileSync(xo, 'utf8').trim().split('\n').map(JSON.parse);
  const g = (e, c) => X.find((r) => r.e === e && r.c === c);
  ok(g(ends[4], 'eps').same && g(ends[4], 'eps').same.last === 0.77 && g(ends[4], 'eps').same.inst === true && g(ends[4], 'sbc').same.last === 50,
    'xbrl.py: הגשה שחסרה ב־companyfacts — מה־instance שלה, והעובדה עם הממד (9.99) לא נכנסת');
  const s4 = g(ends[3], 'sh');
  ok(s4.why === 'q4-approx' && Math.abs(s4.approx - 10 * (1000 * 365 - (1010 * 90 + 1000 * 91 + 990 * 92)) / 92) < 1e-6 && s4.ok === true,
    'xbrl.py: מניות ברבעון 4 — השנה פחות שלושה רבעונים, משוקלל בימים כולל הקצוות, ומותאם לפיצול שאחרי ההגשה');
  const p4 = g(ends[3], 'pretax');
  ok(p4.same && p4.same.last === 300 && p4.same.how === 'fy-9m' && p4.ok === true,
    'xbrl.py: שנה פחות 9 חודשים מאותו בסיס (לא ההצגה מחדש), והשנה רק מדוח שנתי (לא העובדה השגויה ב־10-Q)');
  const t4 = g(ends[3], 'tax'), p5 = g(ends[4], 'pretax');
  ok(!t4.same && t4.alt && t4.alt.tag === 'pool' && t4.alt.last === 60 && p5.alt && p5.alt.how === 'ni+tax' && p5.alt.last === 90,
    'xbrl.py: מאגר מאוחד של תגים (9 חודשים בתג אחד, השנה באחר), ורווח לפני מס = רווח נקי + מס כשלא תויג');
}

// xbrl.py: מניות ורווח למניה רק לפי סוג מניה / שיטה (HSY, ‏SJM), פיצול אחרי ההגשה בלי זוג (MNST), ו־instance חסר → need.tsv
{
  const XB = path.join(tmp, 'xd'), sd = path.join(XB, 'snap'), C = path.join(XB, 'cache', 'data.sec.gov');
  for (const d of [sd, path.join(C, 'api', 'xbrl', 'companyfacts'), path.join(C, 'submissions')]) fs.mkdirSync(d, { recursive: true });
  const [a0, a1, a2, a3] = ['0000000007-26-000001', '0000000007-26-000002', '0000000007-26-000003', '0000000007-26-000004'];
  fs.writeFileSync(path.join(C, 'api', 'xbrl', 'companyfacts', 'CIK0000000007.json'), JSON.stringify({ facts: { 'us-gaap': {
    WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: [{ start: '2026-01-01', end: '2026-03-31', val: 50, accn: a0, form: '10-Q', filed: '2026-05-01' }] } } } } }));
  fs.writeFileSync(path.join(C, 'submissions', 'CIK0000000007.json'), JSON.stringify({ filings: { recent: { form: ['10-Q', '10-Q', '10-Q', '10-Q'],
    accessionNumber: [a3, a2, a1, a0], filingDate: ['2026-11-01', '2026-08-05', '2026-02-01', '2026-05-01'],
    reportDate: ['2026-09-30', '2026-06-30', '2025-12-31', '2026-03-31'], primaryDocument: ['x-0930.htm', 'x-0630.htm', 'x-1231.htm', 'x-0331.htm'], isXBRL: [1, 1, 1, 1] } } }));
  const inst = (acc, doc, s0, e0, body) => {
    const d = path.join(XB, 'cache', 'www.sec.gov', 'Archives', 'edgar', 'data', '7', acc.replace(/-/g, ''));
    fs.mkdirSync(d, { recursive: true });
    const per = '<xbrli:period><xbrli:startDate>' + s0 + '</xbrli:startDate><xbrli:endDate>' + e0 + '</xbrli:endDate></xbrli:period>';
    const cx = (id, mem) => '<xbrli:context id="' + id + '"><xbrli:entity><xbrli:identifier scheme="http://www.sec.gov/CIK">7</xbrli:identifier><xbrli:segment>' +
      mem.map(([ax, m]) => '<xbrldi:explicitMember dimension="us-gaap:' + ax + '">us-gaap:' + m + '</xbrldi:explicitMember>').join('') + '</xbrli:segment></xbrli:entity>' + per + '</xbrli:context>';
    fs.writeFileSync(path.join(d, doc), '<?xml version="1.0"?><xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:us-gaap="http://fasb.org/us-gaap/2025" ' +
      'xmlns:x="http://x.example/2026" xmlns:xbrldi="http://xbrl.org/2006/xbrldi">' +
      cx('cc', [['StatementClassOfStockAxis', 'CommonStockMember']]) + cx('cb', [['StatementClassOfStockAxis', 'CommonClassBMember']]) +
      cx('co', [['AwardTypeAxis', 'EmployeeStockOptionMember'], ['StatementClassOfStockAxis', 'CommonStockMember']]) +
      cx('cr', [['AwardTypeAxis', 'RestrictedStockUnitsRSUMember'], ['StatementClassOfStockAxis', 'CommonStockMember']]) +
      cx('m2', [['EarningsPerShareMethodAxis', 'TwoClassMethodMember']]) + cx('mt', [['EarningsPerShareMethodAxis', 'TreasuryStockMethodMember']]) +
      '<xbrli:unit id="sh"><xbrli:measure>xbrli:shares</xbrli:measure></xbrli:unit><xbrli:unit id="eps"><xbrli:divide><xbrli:unitNumerator><xbrli:measure>iso4217:USD</xbrli:measure>' +
      '</xbrli:unitNumerator><xbrli:unitDenominator><xbrli:measure>xbrli:shares</xbrli:measure></xbrli:unitDenominator></xbrli:divide></xbrli:unit>' + body + '</xbrli:xbrl>');
  };
  const t = (n, c, v, u = 'sh', ns = 'us-gaap') => '<' + ns + ':' + n + ' contextRef="' + c + '" unitRef="' + u + '" decimals="0">' + v + '</' + ns + ':' + n + '>';
  // 6/2026 ‏(HSY): לפי סוג; אין מדולל מתויג → בסיסי 100 + המרת Class B ‏50 (תג פרטי) + אופציות 1 + RSU ‏2 = 153
  inst(a2, 'x-0630_htm.xml', '2026-04-01', '2026-06-30', t('EarningsPerShareDiluted', 'cc', '2.00', 'eps') + t('EarningsPerShareDiluted', 'cb', '1.80', 'eps') +
    t('WeightedAverageNumberOfSharesOutstandingBasic', 'cc', 100) + t('WeightedAverageNumberOfSharesOutstandingBasic', 'cb', 50) +
    t('IncrementalCommonSharesAttributabletoDilutiveEffectofConversion', 'cc', 50, 'sh', 'x') +
    t('IncrementalCommonSharesAttributableToShareBasedPaymentArrangements', 'co', 1) + t('IncrementalCommonSharesAttributableToShareBasedPaymentArrangements', 'cr', 2));
  // 9/2026 ‏(SJM): שתי שיטות — המניות באוצר (205), לא שתי הקבוצות (200)
  inst(a3, 'x-0930_htm.xml', '2026-07-01', '2026-09-30', t('WeightedAverageNumberOfDilutedSharesOutstanding', 'm2', 200) +
    t('WeightedAverageNumberOfDilutedSharesOutstanding', 'mt', 205) + t('EarningsPerShareDiluted', 'm2', '1.00', 'eps') + t('EarningsPerShareDiluted', 'mt', '1.00', 'eps'));
  const ends = ['2025-12-31', '2026-03-31', '2026-06-30', '2026-09-30'];
  fs.writeFileSync(path.join(sd, 'XDM.json'), JSON.stringify({ ok: true, src: 'sec', sym: 'XDM', cik: 7, asOf: '2026-11-19', q: ends,
    splitsUsed: [['2026-08-01', 2]],   // ‏2:1 — אחרי ה־10-Q של 3/2026 ‏(50 → 100), לפני אלה של 6/2026 ו־9/2026
    Q: { eps: [null, null, 2.0, 1.0], sh: [90, 100, 153, 205] },
    tags: { eps: 'EarningsPerShareDiluted', sh: 'WeightedAverageNumberOfDilutedSharesOutstanding' } }));
  const xo = path.join(XB, 'x.jsonl');
  execFileSync('python3', ['-I', path.join(T, 'xbrl.py'), sd, xo], { env: { ...process.env, BD_DIR: XB } });
  const X = fs.readFileSync(xo, 'utf8').trim().split('\n').map(JSON.parse);
  const g = (e, c) => X.find((r) => r.e === e && r.c === c);
  ok(g(ends[2], 'sh').why === 'dim' && g(ends[2], 'sh').dim.last === 153 && /basic\+inc/.test(g(ends[2], 'sh').dim.how) && g(ends[2], 'sh').ok === true &&
    g(ends[2], 'eps').dim.last === 2 && g(ends[2], 'eps').ok === true,
    'xbrl.py: לפי סוג מניה — המניה הרגילה (לא Class B), ובלי מדולל מתויג: הבסיסי + המניות הנוספות של אותו סוג');
  ok(g(ends[3], 'sh').dim.last === 205 && /TreasuryStockMethod/.test(g(ends[3], 'sh').dim.how) && g(ends[3], 'sh').ok === true,
    'xbrl.py: שתי שיטות חישוב — המניות באוצר');
  ok(g(ends[1], 'sh').same.last === 50 && g(ends[1], 'sh').split === 0.5 && g(ends[1], 'sh').ok === true,
    'xbrl.py: פיצול אחרי ההגשה גם בלי רווח למניה להשוואה ההפוכה (MNST)');
  const need = fs.readFileSync(xo + '.need.tsv', 'utf8');
  ok(need.includes(a1) && !need.includes(a2) && !need.includes(a3), 'xbrl.py: ‏10-Q בלי instance במטמון → need.tsv (להורדה ב־xfetch.js ‏--inst)');
}

// ledger.py: יומן האימות — זהות מול המימוש העצמאי, החילוץ מ־SEC, והקוראים לפי ההודעה של הרבעון עצמו
{
  const W = path.join(tmp, 'w');
  fs.mkdirSync(path.join(W, 'pr'), { recursive: true });
  fs.copyFileSync(mOut, path.join(W, 'm1.jsonl'));
  fs.copyFileSync(iOut, path.join(W, 'i1.jsonl'));
  const e = M.EXA.rows[3].e, filed = M.EXA.rows[3].polBy.filed, street = M.EXA.rows[3].hq.a, acc = '0000000009-26-000002';
  fs.writeFileSync(path.join(W, 'x1.jsonl'), [
    { sym: 'EXA', e, c: 'sbc', used: true, sys: M.EXA.rows[3].sbc, same: { last: M.EXA.rows[3].sbc, how: 'ytd' }, ok: true },
    { sym: 'EXA', e, c: 'eps', used: true, sys: M.EXA.rows[3].g, same: { last: M.EXA.rows[3].g + 0.05, how: 'q' }, ok: false },
  ].map((o) => JSON.stringify(o)).join('\n') + '\n');
  const e2 = M.EXA.rows[2].e, acc2 = '0000000009-26-000001', acc3 = '0000000009-26-000003';
  // acc3 — הודעה באוסף שעוד לא נקראה: רבעון בלי הודעה נשאר PEND (לא NOSRC)
  fs.writeFileSync(path.join(W, 'pr', '9.json'), JSON.stringify({ sym: 'EXA', cik: 9, items: [{ acc, filed }, { acc: acc2, filed: '2001-01-01' }, { acc: acc3, filed: '2001-02-01' }] }));
  const rdA = (nums) => JSON.stringify({ acc, cik: 9, er: true, adj: true, ex: true, nums: { pe: e, eps_adj: street, ...nums } }) + '\n';
  for (const who of ['A', 'B']) {
    fs.mkdirSync(path.join(W, 'read', who), { recursive: true });
    // התגמול של הרבעון בהודעה (במיליונים) — המקור השלישי: V2 → V3
    fs.writeFileSync(path.join(W, 'read', who, 'p.jsonl'), rdA({ sbc_total: M.EXA.rows[3].sbc / 1e6, unit: 'millions' }));
  }
  // הרבעון הקודם — בגל (read/w2): ‏A ו־C קוראים כמו המערכת, ‏B חולק → רוב של שניים = V3 (לא SPLIT)
  const pol2 = !!M.EXA.rows[2].pol;
  for (const [who, ex] of [['A', pol2], ['B', !pol2], ['C', pol2]]) {
    fs.mkdirSync(path.join(W, 'read', 'w2', who), { recursive: true });
    fs.writeFileSync(path.join(W, 'read', 'w2', who, 'b00.jsonl'), JSON.stringify({ acc: acc2, cik: 9, er: true, adj: true, ex, nums: { pe: e2 } }) + '\n');
  }
  const cks = path.join(W, 'ciks.tsv');
  fs.writeFileSync(cks, 'EXA\t9\n');
  const lo = path.join(W, 'l.csv');
  execFileSync('python3', ['-I', path.join(T, 'ledger.py'), W, '1', lo], { env: { ...process.env, BD_CIKS: cks } });
  const L = fs.readFileSync(lo, 'utf8').trim().split('\n').map((l) => l.split(','));
  const v = (comp, ee = e) => (L.find((r) => r[0] === 'EXA' && r[1] === ee && r[2] === comp) || [])[4];
  ok(v('pol') === 'V3' && v('street') === 'V2' && v('sbc') === 'V3' && v('gaap') === 'DIFF' && v('ded') === 'V2' && v('bpe', '') === 'V2',
    'ledger.py: מדיניות V3 (שני קוראים), רחוב V2 (ההודעה), תגמול V3 (SEC + ההודעה, יחידת הטבלה), ‏GAAP ‏DIFF, ניכוי ואריח — זהות');
  ok(v('pol', M.EXA.rows[0].e) === 'PEND', 'ledger.py: רבעון בלי הודעה כשיש הודעה באוסף שעוד לא נקראה — PEND');
  ok(v('pol', e2) === 'V3', 'ledger.py: מחלוקת A/B שהקורא השלישי הכריע כמו המערכת — V3 (רוב), מתוך read/w2');

  // ריצה שנייה: כל ההודעות נקראו, פיצול 2:1 אחרי ההודעות, רחוב = GAAP שבהודעה, פסיקה ידנית, ו־moot:yGaap
  fs.writeFileSync(path.join(W, 'pr', '9.json'), JSON.stringify({ sym: 'EXA', cik: 9, items: [{ acc, filed }, { acc: acc2, filed: '2001-01-01' }] }));
  fs.mkdirSync(path.join(W, 'r1', 'snap'), { recursive: true });
  fs.writeFileSync(path.join(W, 'r1', 'snap', 'EXA.json'), JSON.stringify({ splitsUsed: [['2098-01-01', 2]], asOf: '2099-01-01' }));
  // ההודעה הודפסה לפני הפיצול: הרחוב ×2 והרווח ×2; ה־GAAP שבהודעה = המערכת (SEC שונה) → SPLIT
  for (const who of ['A', 'B']) fs.writeFileSync(path.join(W, 'read', who, 'p.jsonl'), rdA({ eps_adj: street * 2, eps_gaap: M.EXA.rows[3].g * 2 }));
  const st2 = M.EXA.rows[2].hq.a;
  for (const [who, ex] of [['A', pol2], ['B', !pol2], ['C', pol2]]) {
    fs.writeFileSync(path.join(W, 'read', 'w2', who, 'b00.jsonl'), JSON.stringify({ acc: acc2, cik: 9, er: true, adj: true, ex, nums: { pe: e2, eps_adj: st2 * 2 + 1, eps_gaap: st2 * 2 } }) + '\n');
  }
  // YGA: מוציא לפי המערכת, הקוראים — לא; הרחוב = GAAP ב־3 מ־4 → הניכוי 0 ממילא: DIFF עם moot:yGaap
  const eY = M.YGA.rows[3].e, accY = '0000000010-26-000001';
  fs.writeFileSync(path.join(W, 'pr', '10.json'), JSON.stringify({ sym: 'YGA', cik: 10, items: [{ acc: accY, filed: '2001-01-01' }] }));
  for (const who of ['A', 'B']) fs.writeFileSync(path.join(W, 'read', 'w2', who, 'y.jsonl'), JSON.stringify({ acc: accY, cik: 10, er: true, adj: true, ex: false, nums: { pe: eY } }) + '\n');
  fs.writeFileSync(cks, 'EXA\t9\nYGA\t10\n');
  const man = path.join(W, 'manual.tsv');
  fs.writeFileSync(man, '# sym\te\tcomp\tverdict\tcause\tראיה\nEXA\t' + e + '\tded\tV3\ttest-cause\tראיה\n');
  execFileSync('python3', ['-I', path.join(T, 'ledger.py'), W, '1', lo], { env: { ...process.env, BD_CIKS: cks, BD_MANUAL: man } });
  const H = fs.readFileSync(lo, 'utf8').trim().split('\n')[0].split(',');
  const L2 = fs.readFileSync(lo, 'utf8').trim().split('\n').map((l) => l.split(','));
  const g2 = (sym, ee, comp, col = 'verdict') => (L2.find((r) => r[0] === sym && r[1] === ee && r[2] === comp) || [])[H.indexOf(col)];
  ok(g2('EXA', e, 'street') === 'V2' && g2('EXA', e, 'street', 'split') === '0.5', 'ledger.py: רחוב מול ההודעה × מקדם הפיצול מאז שהודפסה (splitsUsed)');
  ok(g2('EXA', e, 'gaap') === 'SPLIT', 'ledger.py: ההודעה מסכימה עם המערכת ו־SEC לא — SPLIT');
  ok(g2('EXA', e2, 'street') === 'V2' && g2('EXA', e2, 'street', 'cause') === 'street=gaap≠adj', 'ledger.py: רחוב = GAAP שבהודעה (לא המותאם) — V2 עם הסיבה');
  ok(g2('EXA', M.EXA.rows[0].e, 'pol') === 'NOSRC' && /^no-pr/.test(g2('EXA', M.EXA.rows[0].e, 'pol', 'cause')), 'ledger.py: כל ההודעות נקראו ולרבעון אין הודעה — NOSRC');
  ok(g2('EXA', e, 'ded') === 'V3' && g2('EXA', e, 'ded', 'auto') === 'V2' && g2('EXA', e, 'ded', 'cause') === 'test-cause', 'ledger.py: פסיקה ידנית (manual.tsv) — והאוטומטית נשמרת ב־auto');
  ok(g2('YGA', eY, 'pol') === 'DIFF' && g2('YGA', eY, 'pol', 'cause') === 'moot:yGaap', 'ledger.py: מחלוקת במדיניות כשהרחוב = GAAP — DIFF עם moot:yGaap');
}

// readcmp.pe_norm: סוף התקופה בכל הצורות שהקוראים כתבו → YYYY-MM-DD
{
  const r = spawnSync('python3', ['-I', '-c', 'import sys,json; sys.path.insert(0, sys.argv[1]); from readcmp import pe_norm; print(json.dumps([pe_norm(x) for x in sys.argv[2:]], separators=(",", ":")))', T,
    '2026-03-31', 'September 30, 2025', 'June 30,2026', '9/30/25', '31 March 2025', 'Mar 29, 2026', 'FY2025', ''], { encoding: 'utf8' });
  ok(r.status === 0 && r.stdout.trim() === JSON.stringify(['2026-03-31', '2025-09-30', '2026-06-30', '2025-09-30', '2025-03-31', '2026-03-29', null, null]),
    'readcmp.pe_norm: ISO, שם חודש מלא/מקוצר, בלי רווח, M/D/YY, יום־חודש־שנה; לא תאריך → None');
}

// readcmp.py: השוואת הקוראים — יחידות, החלפת sh_dil/sh_adj, מספרים רק בהודעת תוצאות, מחלוקות ל־C ומטריצה מול המסווג
{
  const BD = path.join(tmp, 'rc'), WD = path.join(BD, 'read', 'w2');
  for (const d of ['A', 'B', 'C', 'batches']) fs.mkdirSync(path.join(WD, d), { recursive: true });
  const accs = ['0000000001-26-000001', '0000000001-26-000002', '0000000001-26-000003', '0000000001-26-000004'];
  fs.writeFileSync(path.join(WD, 'batches', 'b00.txt'), accs.map((a) => '1/' + a + '.txt').join('\n') + '\n');
  fs.writeFileSync(path.join(WD, 'batches.json'), JSON.stringify([{ id: 'b00', list: path.join(WD, 'batches', 'b00.txt') }]));
  fs.writeFileSync(path.join(BD, 'sys.jsonl'), accs.map((acc, i) => JSON.stringify({ sym: 'RCX', cik: 1, acc, filed: '2026-0' + (i + 1) + '-15', sys: true,
    c: { er: i !== 2, ex: true, fut: true, h: 'E' }, call: { er: i !== 2, ex: true, fut: true } })).join('\n') + '\n');
  const row = (acc, o, nums) => JSON.stringify({ acc, cik: '1', er: true, pre: false, adj: true, ex: true, partial: false, chg: 'none', fut: true, quote: 'q', conf: 'high', ...o, nums: { pe: '2026-03-31', eps_gaap: 1.04, eps_adj: 1.5, ...nums } });
  const w = (who, lines) => fs.writeFileSync(path.join(WD, who, 'b00.jsonl'), lines.join('\n') + '\n');
  w('A', [row(accs[0], {}, { sbc_rec: 630, sbc_rec_ps: 0.6, unit: 'millions', sh_dil: null, sh_adj: 138 }), row(accs[1], {}, {}),
    row(accs[2], { er: false, adj: false, ex: null }, { pe: null }), row(accs[3], {}, {})]);
  w('B', [row(accs[0], {}, { sbc_rec: 630000, unit: 'thousands', sh_dil: 138 }), row(accs[1], { ex: false, fut: false }, {}),
    row(accs[2], { er: false, adj: false, ex: null }, {}), row(accs[3], { ex: false, fut: false }, {})]);
  w('C', [row(accs[3], { ex: false, fut: false }, {})]);
  execFileSync('python3', ['-I', path.join(T, 'readcmp.py'), BD, 'w2']);
  const C = fs.readFileSync(path.join(WD, 'cmp.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const by = (a) => C.find((r) => r.acc === a);
  const disp = fs.readFileSync(path.join(WD, 'disputes.txt'), 'utf8');
  ok(by(accs[0]).dis.length === 0 && by(accs[0]).cons.sh_dil === 138, 'readcmp.py: יחידות (מיליונים מול אלפים), החלפת sh_dil/sh_adj, וערך למניה רק אצל אחד כשהסכום מוסכם — הסכמה');
  ok(by(accs[2]).dis.length === 0, 'readcmp.py: בהודעה שאינה הודעת תוצאות המספרים לא נבדקים');
  ok(disp.includes(accs[1]) && !disp.includes(accs[3]) && !disp.includes(accs[0]) && by(accs[1]).dis.includes('ex'),
    'readcmp.py: מחלוקת על ex בלי הכרעה → disputes.txt; מחלוקת ש־C הכריע — לא');
  ok(by(accs[3]).cons.ex === false && fs.readFileSync(path.join(WD, 'cmp.sum.txt'), 'utf8').includes(accs[3]),
    'readcmp.py: רוב של שניים (B+C) מול המסווג — מופיע באי־ההתאמות');
}

// batches.py (חלוקה לקבוצות; קובץ גדול — לבד) ו־reader.workflow.mjs (תקין תחבירית)
{
  const BD = path.join(tmp, 'bt');
  fs.mkdirSync(path.join(BD, 'pr'), { recursive: true });
  const mk = (sym, cik, sizes) => {
    fs.mkdirSync(path.join(BD, 'prt', String(cik)), { recursive: true });
    const items = sizes.map((n, i) => ({ acc: String(cik).padStart(10, '0') + '-26-00000' + i, filed: '2026-0' + (i + 1) + '-01' }));
    items.forEach((it, i) => fs.writeFileSync(path.join(BD, 'prt', String(cik), it.acc + '.txt'), 'x'.repeat(sizes[i])));
    fs.writeFileSync(path.join(BD, 'pr', cik + '.json'), JSON.stringify({ sym, cik, items }));
  };
  mk('BBB', 2, [200, 200]); mk('AAA', 1, [300, 900]); mk('CCC', 3, [100]);
  const r = spawnSync('python3', ['-I', path.join(T, 'batches.py'), BD, 'wt', '0', '2', '500', '800'], { encoding: 'utf8' });
  const B = JSON.parse(fs.readFileSync(path.join(BD, 'read', 'wt', 'batches.json'), 'utf8'));
  const bigB = B.filter((b) => b.big.length), js = JSON.stringify(B);
  ok(r.status === 0 && B.length === 3 && bigB.length === 1 && bigB[0].n === 1 && bigB[0].syms[0] === 'AAA' && B.every((b) => b.big.length || b.chars <= 500) &&
    B.reduce((t, b) => t + b.n, 0) === 4 && js.includes('BBB') && !js.includes('CCC'), 'batches.py: לפי סדר הסימול, עד התקרה; קובץ גדול — קבוצה לבד; רק הטווח');
  // סקריפט Workflow רץ בתוך פונקציה אסינכרונית (return ו־await בראש הקובץ) — בודקים כך
  const wf = fs.readFileSync(path.join(T, 'reader.workflow.mjs'), 'utf8').replace(/^export const meta/m, 'const meta');
  const wfp = path.join(tmp, 'wf.js');
  fs.writeFileSync(wfp, 'async function wf(args, agent, parallel, phase, log) {\n' + wf + '\n}\n');
  ok(spawnSync(process.execPath, ['--check', wfp]).status === 0 && /export const meta = \{/.test(fs.readFileSync(path.join(T, 'reader.workflow.mjs'), 'utf8')), 'reader.workflow.mjs: תקין תחבירית (בתוך פונקציה אסינכרונית), עם meta');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${n} בדיקות עברו`);
