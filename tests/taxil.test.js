// taxil.test.js — מרכז המס: מנות FIFO, ארבעת המצבים, קיזוז והעברת הפסד, דיבידנד וזיכוי, מס יסף,
// "המס אם אמכור היום", קציר הפסדים, בריאות נתונים, W-8BEN, ושער יציג (op:'boifx').
// כל הנתונים פיקטיביים לחלוטין — אסור להכניס נתוני משתמש אמיתיים.
const path = require('path');
const T = require('../taxil.js');
const B = require(path.join(__dirname, '..', 'ibkr-proxy/lib/boifx.js'));

let n = 0;
function ok(cond, name) {
  n++;
  if (!cond) { console.error('FAIL - ' + name); process.exit(1); }
  console.log('ok - ' + name);
}
function approx(a, b, eps, name) { ok(typeof a === 'number' && Math.abs(a - b) <= eps, name + ' (קיבלנו ' + a + ', ציפינו ' + b + ')'); }

// שערים פיקטיביים לפי תאריך
const FX = { '2023-01-02': 5, '2023-06-01': 4, '2024-01-02': 3, '2024-03-01': 3.5, '2024-06-03': 4 };
const fxOf = (cur, d) => (cur === 'USD' ? (FX[d] || T.tiRateOn(Object.entries(FX).sort(), d)) : null);

/* ---------- ארבעת המצבים ---------- */
ok(T.tiFourCase(100, 300) === 100, 'שני רווחים — הנמוך');
ok(T.tiFourCase(-100, -300) === -100, 'שני הפסדים — ההפסד הקטן');
ok(T.tiFourCase(100, -50) === 0 && T.tiFourCase(-100, 50) === 0, 'סימנים שונים — אפס');

/* ---------- FIFO: הדוגמה מהמחקר — קנייה $100 בשער 5, מכירה $200 בשער 3 ---------- */
{
  const r = T.tiFifo([
    { symbol: 'XYZ', date: '2023-01-02', qty: 1, price: 100, side: 'BUY', currency: 'USD', tradeId: '1' },
    { symbol: 'XYZ', date: '2024-01-02', qty: -1, price: 200, side: 'SELL', currency: 'USD', tradeId: '2' },
  ], fxOf);
  const s = r.sales[0];
  approx(s.gIls, 100, 1e-9, 'רווח בשקלים: 600 − 500');
  approx(s.gFx, 300, 1e-9, 'רווח בדולר × שער המכירה: 100 × 3');
  approx(s.taxable, 100, 1e-9, 'החייב = 100 ₪ (רכיב המחיר בלבד, בלי רווח הדולר)');
  ok(!r.open.length && !r.issues.length, 'אין מנות פתוחות ואין בעיות');
}

/* ---------- FIFO: מכירה חלקית, עמלות, שני חלקים ---------- */
{
  const r = T.tiFifo([
    { symbol: 'AAA', date: '2023-01-02', qty: 10, price: 50, commission: -2, side: 'BUY', currency: 'USD', tradeId: '10' },
    { symbol: 'AAA', date: '2023-06-01', qty: 10, price: 60, commission: -2, side: 'BUY', currency: 'USD', tradeId: '11' },
    { symbol: 'AAA', date: '2024-03-01', qty: -15, price: 70, commission: -3, side: 'SELL', currency: 'USD', tradeId: '12' },
  ], fxOf);
  ok(r.sales.length === 2, 'מכירה של 15 מתפצלת לשתי מנות');
  const [a, b] = r.sales;
  ok(a.qty === 10 && a.buyDate === '2023-01-02' && b.qty === 5 && b.buyDate === '2023-06-01', 'FIFO — הוותיקה קודם');
  approx(a.cost, 502, 1e-9, 'עמלת קנייה נכנסת לעלות (10×50 + 2)');
  approx(a.proceeds, 10 * (70 - 3 / 15), 1e-9, 'עמלת מכירה יורדת מהתמורה, יחסית לכמות');
  approx(b.cost, 5 * (60 + 0.2), 1e-9, 'העלות של חצי מנה — לפי עלות ליחידה');
  ok(r.open.length === 1 && Math.abs(r.open[0].qty - 5) < 1e-9 && r.open[0].fx === 4, 'נשארו 5 מהמנה השנייה, עם שער הקנייה שלה');
}

/* ---------- בעיות נתונים ---------- */
{
  const r = T.tiFifo([
    { symbol: 'ZZZ', date: '2024-01-02', qty: -3, price: 10, side: 'SELL', currency: 'USD' },
    { symbol: 'QQQ', date: '2024-01-02', qty: 1, price: 10, side: 'BUY', currency: 'EUR' },
  ], fxOf);
  ok(r.issues.some((i) => i.type === 'noLots' && i.sym === 'ZZZ' && i.qty === 3), 'מכירה בלי מנות (היסטוריה חסרה) — מסומנת');
  ok(r.issues.some((i) => i.type === 'noFx' && i.sym === 'QQQ'), 'בלי שער למטבע — מסומן ולא מנוחש');
}

/* ---------- נייר שקלי: נומינלי, בלי שער ---------- */
{
  const r = T.tiFifo([
    { symbol: 'TA1', date: '2023-01-02', qty: 100, price: 10, side: 'BUY', currency: 'ILS' },
    { symbol: 'TA1', date: '2024-01-02', qty: -100, price: 12, side: 'SELL', currency: 'ILS' },
  ], fxOf);
  ok(r.sales[0].nominal && Math.abs(r.sales[0].taxable - 200) < 1e-9, 'נייר שקלי: רווח נומינלי 200 ומסומן');
}

/* ---------- דיבידנדים וניכוי במקור ---------- */
const CASH = [
  { date: '2024-03-01', type: 'Dividends', amount: 100, currency: 'USD', description: 'AAA(US0000000001) Cash Dividend USD 1.00 per Share' },
  { date: '2024-03-01', type: 'Withholding Tax', amount: -25, currency: 'USD', description: 'AAA(US0000000001) Cash Dividend - US Tax' },
  { date: '2024-06-03', type: 'Dividends', amount: 40, currency: 'USD', description: 'BBB(US0000000002) Cash Dividend' },
  { date: '2024-06-03', type: 'Withholding Tax', amount: -12, currency: 'USD', description: 'BBB(US0000000002) - US Tax' },
  { date: '2024-06-03', type: 'Withholding Tax', amount: 2, currency: 'USD', description: 'BBB(US0000000002) - US Tax reversal' },
  { date: '2024-06-03', type: 'Broker Interest Received', amount: 10, currency: 'USD', description: 'USD Credit Interest' },
  { date: '2024-06-03', type: 'Deposits/Withdrawals', amount: 5000, currency: 'USD', description: 'Deposit' },
];
const divs = T.tiDividends(CASH, fxOf);
{
  const a = divs.find((d) => d.sym === 'AAA'), b = divs.find((d) => d.sym === 'BBB');
  ok(divs.length === 3, 'שני דיבידנדים וריבית; הפקדה לא נספרת');
  ok(a.country === 'US' && a.gross === 100 && a.wh === 25 && Math.abs(a.grossIls - 350) < 1e-9, 'דיבידנד: ברוטו, ניכוי ושקלים לפי שער יום התשלום');
  approx(b.wh, 10, 1e-12, 'ביטול ניכוי מקטין את הניכוי');
  approx(b.whRate, 0.25, 1e-12, 'שיעור הניכוי בפועל');
  ok(divs.some((d) => d.kind === 'interest' && d.gross === 10), 'ריבית מזומן נפרדת');
}

/* ---------- שנת מס ---------- */
{
  // רווח מוכר 1,000 ₪, הפסד מוכר 400 ₪, הפסד מועבר 100
  const sales = [
    { sellDate: '2024-05-01', taxable: 1000 }, { sellDate: '2024-07-01', taxable: -400 }, { sellDate: '2023-07-01', taxable: 9999 },
  ];
  const y = T.tiYear(2024, sales, [], { carry: 100, other: 0 });
  ok(y.sales === 2 && y.gains === 1000 && y.losses === 400, 'רק המכירות של השנה');
  approx(y.taxable, 500, 1e-9, 'קיזוז שוטף ואז הפסד מועבר: 1,000 − 400 − 100');
  approx(y.cgTax, 125, 1e-9, '25% מס רווח הון');
  ok(y.carryOut === 0 && y.carryUsed === 100, 'ההפסד המועבר נוצל');
  ok(y.flags.includes('fourCase') && y.flags.includes('capSurtax'), 'כללים שלא אומתו מסומנים');
  // שנת הפסד: 600 נטו, דיבידנד שנוכה במלואו → לא מקזזים, הכל מועבר
  const d1 = [{ date: '2024-03-01', kind: 'dividend', grossIls: 350, whIls: 87.5 }];
  const y2 = T.tiYear(2024, [{ sellDate: '2024-05-01', taxable: -600 }], d1, { carry: 0, other: 0 });
  ok(y2.offIncome === 0 && y2.carryOut === 600, 'הפסד לא נשרף מול דיבידנד שכבר נוכה ב־25%');
  approx(y2.extraInc, 0, 1e-9, 'דיבידנד עם 25% ניכוי — אין מס נוסף בישראל');
  // דיבידנד שלא נוכה בו כלום: ההפסד מקזז אותו
  const d2 = [{ date: '2024-03-01', kind: 'dividend', grossIls: 200, whIls: 0 }];
  const y3 = T.tiYear(2024, [{ sellDate: '2024-05-01', taxable: -600 }], d2, { other: 0 });
  ok(y3.offIncome === 200 && y3.carryOut === 400 && y3.extraInc === 0, 'הפסד שוטף מקזז דיבידנד בלי ניכוי, והשאר מועבר');
  // דיבידנד עם 15% ניכוי (UCITS/אמנה אחרת): מס נוסף 10%
  const y4 = T.tiYear(2024, [], [{ date: '2024-03-01', kind: 'dividend', grossIls: 1000, whIls: 150 }], { other: 0 });
  approx(y4.extraInc, 100, 1e-9, 'ניכוי 15% → יתרה של 10% לתשלום בישראל');
  approx(y4.credit, 150, 1e-9, 'הזיכוי = מה שנוכה, עד גובה המס הישראלי');
}

/* ---------- מס יסף ---------- */
{
  const y = T.tiYear(2026, [{ sellDate: '2026-02-01', taxable: 200000 }], [], { other: 700000 });
  // סה"כ 900,000; מעל 721,560: 178,440
  approx(y.surtax3, 0.03 * 178440, 1e-6, 'מס יסף 3% על החלק שמעל התקרה');
  approx(y.surtax2, 0.02 * 178440, 1e-6, 'שכבת 2% על החלק ההוני שמעל התקרה');
  const y24 = T.tiYear(2024, [{ sellDate: '2024-02-01', taxable: 200000 }], [], { other: 700000 });
  ok(y24.surtax2 === 0, 'ב־2024 אין שכבה הונית');
  const yu = T.tiYear(2026, [{ sellDate: '2026-02-01', taxable: 1000 }], [], {});
  ok(yu.flags.includes('otherUnknown'), 'בלי הכנסה אחרת — מס היסף מסומן כלא ידוע');
}

/* ---------- רצף שנים ---------- */
{
  const rs = T.tiYears([{ sellDate: '2023-05-01', taxable: -500 }, { sellDate: '2024-05-01', taxable: 800 }], []);
  ok(rs.length === 2 && rs[0].carryOut === 500 && Math.abs(rs[1].taxable - 300) < 1e-9, 'הפסד 2023 עובר ומקזז את 2024');
}

/* ---------- המס אם אמכור היום, קציר הפסדים ---------- */
{
  const open = [
    { sym: 'UP', cur: 'USD', date: '2023-01-02', qty: 10, unit: 100, fx: 5 },   // 5,000 ₪
    { sym: 'DN', cur: 'USD', date: '2023-01-02', qty: 10, unit: 100, fx: 5 },   // 5,000 ₪
    { sym: 'FX', cur: 'USD', date: '2023-01-02', qty: 10, unit: 100, fx: 5 },
  ];
  const price = { UP: 150, DN: 80, FX: 110 };
  const u = T.tiUnrealized(open, (s) => price[s], () => 4);
  const by = Object.fromEntries(u.map((x) => [x.sym, x]));
  approx(by.UP.taxable, 1000, 1e-9, 'עלייה במחיר וירידה בדולר: חייב רק 1,000 (6,000 − 5,000)');
  approx(by.DN.taxable, -800, 1e-9, 'ירידה במחיר: הפסד מוכר −800 (הקטן מבין −1,800 בשקלים ו־−800 בדולר)');
  ok(by.FX.taxable === 0 && by.FX.gFx > 0 && by.FX.gIls < 0, 'עלייה בדולר וירידה בשקלים — אפס');
  const h = T.tiHarvest(u, { year: 2026, taxable: 500 });
  ok(h.length === 1 && h[0].sym === 'DN', 'קציר: רק מנה עם הפסד מוכר');
  approx(h[0].saves, 125, 1e-9, 'חוסך 25% מהרווח החייב שנשאר (500)');
  approx(h[0].carry, 300, 1e-9, 'יתרת ההפסד עוברת לשנה הבאה');
  ok(T.tiUnrealized([{ sym: 'NA', cur: 'USD', qty: 1, unit: 1, fx: 3 }], () => 0, () => 4)[0].missing, 'בלי מחיר — מסומן חסר');
}

/* ---------- בריאות נתונים ו־W-8BEN ---------- */
{
  const c = T.tiCheck([{ sym: 'AAA', qty: 5 }], [{ symbol: 'AAA', qty: 5 }, { symbol: 'BBB', qty: 20 }, { symbol: 'USD', asset: 'CASH', qty: 9 }]);
  ok(c.length === 1 && c[0].sym === 'BBB' && c[0].diff === 20, 'אחזקה בלי עסקאות — חסרה היסטוריה');
  const w = T.tiW8([{ kind: 'dividend', country: 'US', whRate: 0.3, grossIls: 1000, date: '2024-01-01', sym: 'X' }, { kind: 'dividend', country: 'US', whRate: 0.25 }]);
  ok(w.length === 1 && Math.abs(w[0].lostIls - 50) < 1e-9, 'ניכוי 30% — 5% אבודים, תזכורת לחדש W-8BEN');
}

/* ---------- כללים לפי שנה ---------- */
ok(T.tiRules(2024).capSurtax === null && T.tiRules(2027).capSurtax.r === 0.02, 'שנה שלא הוגדרה יורשת את האחרונה שלפניה');
ok(T.tiRateOn([['2024-01-01', 3.5], ['2024-01-03', 3.6]], '2024-01-02') === 3.5 && T.tiRateOn([['2024-01-01', 3.5]], '2023-12-31') === null, 'שער ביום הפרסום הקודם; לפני הסדרה — null');

/* ---------- השרתון: op:'boifx' ---------- */
(async () => {
  const csv = 'SERIES_CODE,FREQ,TIME_PERIOD,OBS_VALUE\nRER_USD_ILS,D,2026-10-21,3.091\nRER_USD_ILS,D,2026-10-20,3.106\nRER_USD_ILS,D,bad,1\n';
  const p = B._parse(csv);
  ok(p.length === 2 && p[0][0] === '2026-10-20' && p[1][1] === 3.091, 'boifx: פענוח CSV לפי שמות העמודות, ממוין, בלי שורות פגומות');
  const mkRes = () => { const r = { code: 0, body: null, headers: {} }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; }; return r; };
  let calls = 0, lastUrl = '';
  global.fetch = async (u) => { calls++; lastUrl = u; return { status: 200, text: async () => csv }; };
  B._cache.clear();
  const r1 = mkRes();
  await B.handle({ op: 'boifx', cur: 'usd', from: '2026-10-21' }, r1);
  ok(r1.code === 200 && r1.body.ok && r1.body.rows.length === 1 && r1.body.rows[0][0] === '2026-10-21', 'boifx: מחזיר מהתאריך המבוקש');
  ok(/RER_USD_ILS\?startperiod=2026-10-21/.test(lastUrl), 'boifx: הסדרה הרשמית של בנק ישראל');
  const r2 = mkRes();
  await B.handle({ op: 'boifx', cur: 'USD', from: '2026-10-22' }, r2);
  ok(calls === 1, 'boifx: בקשה שנייה מהמטמון');
  const r3 = mkRes();
  await B.handle({ op: 'boifx', cur: 'XXX' }, r3);
  ok(r3.code === 400, 'boifx: מטבע לא מוכר — 400');
  global.fetch = async () => ({ status: 500, text: async () => '' });
  B._cache.clear();
  const r4 = mkRes();
  await B.handle({ op: 'boifx', cur: 'EUR', from: '2026-01-01' }, r4);
  ok(r4.code === 502, 'boifx: בנק ישראל לא ענה ואין מטמון — 502');
  const fs = require('fs');
  const hist = fs.readFileSync(path.join(__dirname, '..', 'ibkr-proxy/api/history.js'), 'utf8');
  ok(/op === 'boifx'/.test(hist), 'history.js מנתב את op:boifx (בלי פונקציה חדשה ב־Vercel)');
  console.log('# taxil: ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + e.stack); process.exit(1); });
