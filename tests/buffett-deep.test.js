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
  fs.writeFileSync(path.join(W, 'pr', '9.json'), JSON.stringify({ sym: 'EXA', cik: 9, items: [{ acc, filed }] }));
  for (const who of ['A', 'B']) {
    fs.mkdirSync(path.join(W, 'read', who), { recursive: true });
    fs.writeFileSync(path.join(W, 'read', who, 'p.jsonl'), JSON.stringify({ acc, cik: 9, er: true, adj: true, ex: true, nums: { pe: e, eps_adj: street } }) + '\n');
  }
  const cks = path.join(W, 'ciks.tsv');
  fs.writeFileSync(cks, 'EXA\t9\n');
  const lo = path.join(W, 'l.csv');
  execFileSync('python3', ['-I', path.join(T, 'ledger.py'), W, '1', lo], { env: { ...process.env, BD_CIKS: cks } });
  const L = fs.readFileSync(lo, 'utf8').trim().split('\n').map((l) => l.split(','));
  const v = (comp, ee = e) => (L.find((r) => r[0] === 'EXA' && r[1] === ee && r[2] === comp) || [])[4];
  ok(v('pol') === 'V3' && v('street') === 'V2' && v('sbc') === 'V2' && v('gaap') === 'DIFF' && v('ded') === 'V2' && v('bpe', '') === 'V2',
    'ledger.py: מדיניות V3 (שני קוראים), רחוב V2 (ההודעה), תגמול V2, ‏GAAP ‏DIFF, ניכוי ואריח — זהות');
  ok(v('pol', M.EXA.rows[0].e) === 'PEND', 'ledger.py: רבעון בלי קריאה — PEND');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${n} בדיקות עברו`);
