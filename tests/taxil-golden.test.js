// taxil-golden.test.js — סט הזהב של מרכז המס (01/11/2026): מקרים שחושבו ביד, כל אחד עם החישוב בהערה.
// התנאי לדוח לרו״ח: כל שורה בדוח (tiReport) נגזרת מהמנוע, והמנוע חייב להחזיר בדיוק את הסכומים כאן.
// מקור הכללים: docs/invest.md, "מרכז המס — כללים מאומתים". כל הנתונים פיקטיביים לחלוטין.
const T = require('../taxil.js');

let n = 0;
function ok(cond, name) {
  n++;
  if (!cond) { console.error('FAIL - ' + name); process.exit(1); }
  console.log('ok - ' + name);
}
const near = (a, b) => typeof a === 'number' && Math.abs(a - b) < 0.005;
function eq(a, b, name) { ok(near(a, b), name + ' (קיבלנו ' + a + ', ציפינו ' + b + ')'); }

const tr = (sym, date, qty, price, fee, id) => ({ symbol: sym, date: date, qty: qty, price: price, commission: -(fee || 0), currency: 'USD', side: qty > 0 ? 'BUY' : 'SELL', tradeId: String(id) });
const fxFrom = (map) => (cur, d) => (cur === 'USD' ? T.tiRateOn(Object.entries(map).sort(), d) : null);

/* G1 — שני רווחים, הנמוך קובע (88 + פס״ד מוזס).
   קנייה 10 × $100 בשער 3.5, מכירה 10 × $120 בשער 3.6.
   בשקלים: 1,200×3.6 − 1,000×3.5 = 4,320 − 3,500 = 820. במטבע: 200×3.6 = 720 → חייב 720, מס 180. */
{
  const f = T.tiFifo([tr('G', '2024-01-02', 10, 100, 0, 1), tr('G', '2025-01-02', -10, 120, 0, 2)], fxFrom({ '2024-01-02': 3.5, '2025-01-02': 3.6 }));
  eq(f.sales[0].gIls, 820, 'G1 רווח בשקלים');
  eq(f.sales[0].gFx, 720, 'G1 רווח במטבע × שער');
  eq(f.sales[0].taxable, 720, 'G1 חייב = הנמוך');
  eq(T.tiYear(2025, f.sales, []).cgTax, 180, 'G1 מס 25%');
}

/* G2 — רווח בדולר, הפסד בשקלים (הדולר ירד) → סימנים שונים → 0.
   קנייה 10 × $100 בשער 4.0, מכירה 10 × $110 בשער 3.5: בשקלים 3,850 − 4,000 = −150; במטבע 100×3.5 = 350 → 0 */
{
  const f = T.tiFifo([tr('G', '2024-01-02', 10, 100, 0, 1), tr('G', '2025-01-02', -10, 110, 0, 2)], fxFrom({ '2024-01-02': 4, '2025-01-02': 3.5 }));
  eq(f.sales[0].gIls, -150, 'G2 בשקלים');
  eq(f.sales[0].taxable, 0, 'G2 לא רווח ולא הפסד');
}

/* G3 — שני הפסדים, ההפסד הקטן קובע.
   קנייה 10 × $100 בשער 3.5, מכירה 10 × $90 בשער 3.7: בשקלים 3,330 − 3,500 = −170; במטבע −100×3.7 = −370 → −170 */
{
  const f = T.tiFifo([tr('G', '2024-01-02', 10, 100, 0, 1), tr('G', '2025-01-02', -10, 90, 0, 2)], fxFrom({ '2024-01-02': 3.5, '2025-01-02': 3.7 }));
  eq(f.sales[0].taxable, -170, 'G3 הפסד מוכר = הקטן');
}

/* G4 — FIFO חלקי עם עמלות (קנייה: לעלות; מכירה: מהתמורה).
   קנייה א: 10 × $100 + $5 (שער 3.5) → עלות ליחידה 100.5. קנייה ב: 10 × $120 + $5 (שער 3.6) → 120.5.
   מכירה 15 × $130 − $6 (שער 3.7) → תמורה נטו ליחידה 129.6.
   חלק א (10): עלות 1,005, תמורה 1,296. בשקלים 4,795.2 − 3,517.5 = 1,277.7; במטבע 291×3.7 = 1,076.7 → 1,076.7
   חלק ב (5):  עלות 602.5, תמורה 648. בשקלים 2,397.6 − 2,169 = 228.6; במטבע 45.5×3.7 = 168.35 → 168.35
   סה״כ חייב 1,245.05 · נשארו 5 יחידות מקנייה ב */
{
  const f = T.tiFifo([tr('G', '2024-01-02', 10, 100, 5, 1), tr('G', '2024-03-01', 10, 120, 5, 2), tr('G', '2025-01-02', -15, 130, 6, 3)],
    fxFrom({ '2024-01-02': 3.5, '2024-03-01': 3.6, '2025-01-02': 3.7 }));
  ok(f.sales.length === 2, 'G4 שני חלקי FIFO');
  eq(f.sales[0].taxable, 1076.7, 'G4 חלק א');
  eq(f.sales[1].taxable, 168.35, 'G4 חלק ב');
  eq(f.sales[0].taxable + f.sales[1].taxable, 1245.05, 'G4 סה״כ');
  ok(f.open.length === 1 && near(f.open[0].qty, 5) && f.open[0].date === '2024-03-01', 'G4 המנה שנשארה');
}

/* G5 — הפסד השנה מול דיבידנד: קיזוז חובה (92(א)(4)), והזיכוי אובד.
   מכירה בהפסד מוכר 1,000 ₪; דיבידנד $100 בשער 3.7 = 370 ₪, נוכה $25 = 92.5 ₪.
   הקיזוז: 370 מתוך 1,000 → הכנסת הדיבידנד 0, מס ישראלי 0, זיכוי 0, זיכוי שאבד 92.5; עובר לשנה הבאה 630. */
{
  const sales = [{ sellDate: '2025-05-01', taxable: -1000 }];
  const divs = [{ date: '2025-06-01', kind: 'dividend', grossIls: 370, whIls: 92.5 }];
  const Y = T.tiYear(2025, sales, divs, { other: 0 });
  eq(Y.offIncome, 370, 'G5 קוזז מול הדיבידנד');
  eq(Y.carryOut, 630, 'G5 עובר לשנה הבאה');
  eq(Y.extraInc, 0, 'G5 אין יתרה על הדיבידנד');
  eq(Y.creditLost, 92.5, 'G5 הזיכוי שאבד');
  eq(Y.due, 0, 'G5 אין מס');
}

/* G6 — דיבידנד 25% בחו״ל: אין יתרה. דיבידנד 15% בחו״ל: יתרה 10%.
   $200 בשער 3.5 = 700 ₪. נוכה 25% = 175 → 0. נוכה 15% = 105 → 175 − 105 = 70 */
{
  const d25 = T.tiYear(2025, [], [{ date: '2025-03-01', kind: 'dividend', grossIls: 700, whIls: 175 }]);
  const d15 = T.tiYear(2025, [], [{ date: '2025-03-01', kind: 'dividend', grossIls: 700, whIls: 105 }]);
  eq(d25.extraInc, 0, 'G6 25% — אין יתרה');
  eq(d15.extraInc, 70, 'G6 15% — יתרה 70');
}

/* G7 — הפסד מועבר בין שנים, רק מול רווח הון (92(ב)).
   2024: הפסד 2,000 (בלי דיבידנד) → עובר 2,000. 2025: רווח 1,500 → מקוזז כולו, חייב 0, עובר 500.
   2026: רווח 1,000 → 500 מקוזזים, חייב 500, מס 125 */
{
  const sales = [{ sellDate: '2024-04-01', taxable: -2000 }, { sellDate: '2025-04-01', taxable: 1500 }, { sellDate: '2026-04-01', taxable: 1000 }];
  const ys = T.tiYears(sales, [], {});
  eq(ys[0].carryOut, 2000, 'G7 2024 עובר');
  eq(ys[1].taxable, 0, 'G7 2025 חייב');
  eq(ys[1].carryOut, 500, 'G7 2025 עובר');
  eq(ys[2].taxable, 500, 'G7 2026 חייב');
  eq(ys[2].cgTax, 125, 'G7 2026 מס');
}

/* G8 — מס יסף (121ב, מ־2025): 3% על כל ההכנסה מעל 721,560; 2% על ההכנסה ההונית לבדה מעל אותו סף.
   הכנסה אחרת 700,000, רווח הון 100,000 → סה״כ 800,000: 3% × 78,440 = 2,353.2; הוני 100,000 < סף → 0.
   הכנסה אחרת 0, רווח הון 800,000: 3% × 78,440 = 2,353.2 ועוד 2% × 78,440 = 1,568.8 → 3,922 */
{
  const a = T.tiYear(2025, [{ sellDate: '2025-04-01', taxable: 100000 }], [], { other: 700000 });
  eq(a.surtax, 2353.2, 'G8 3% בלבד');
  const b = T.tiYear(2025, [{ sellDate: '2025-04-01', taxable: 800000 }], [], { other: 0 });
  eq(b.surtax, 3922, 'G8 3% + 2%');
}

/* G9 — הדוח לרו״ח: הסכומים בדוח זהים לשנת המס, ושורה ל־1325 לכל חלק FIFO */
{
  const f = T.tiFifo([tr('G', '2024-01-02', 10, 100, 5, 1), tr('G', '2024-03-01', 10, 120, 5, 2), tr('G', '2025-01-02', -15, 130, 6, 3)],
    fxFrom({ '2024-01-02': 3.5, '2024-03-01': 3.6, '2025-01-02': 3.7 }));
  const divs = [{ date: '2025-06-01', kind: 'dividend', country: 'US', sym: 'G', grossIls: 700, whIls: 175 }, { date: '2025-07-01', kind: 'dividend', country: 'IE', sym: 'H', grossIls: 100, whIls: 0 }];
  const Y = T.tiYear(2025, f.sales, divs);
  const R = T.tiReport(2025, f.sales, divs, Y);
  ok(R.s1325.length === 2, 'G9 שתי שורות 1325');
  eq(R.s1325.reduce((a, r) => a + r.taxable, 0), Y.gains - Y.losses, 'G9 1325 מסתכם לשנת המס');
  eq(R.s1322.cgTax, Y.cgTax, 'G9 1322 = מס רווח ההון');
  ok(R.s1324c.length === 2 && R.s1324c[0].country === 'IE', 'G9 1324 לפי מדינה');
  eq(R.s1324c.find((c) => c.country === 'US').whIls, 175, 'G9 1324 — הניכוי בארה״ב');
  ok(T.tiReport(2024, f.sales, divs, null).s1325.length === 0, 'G9 שנה בלי מכירות — אין שורות');
}

/* G10 — מד העיזבון: ISIN של ארה״ב נספר, אירלנד לא, ת״א לא; בלי ISIN — ניחוש לפי דולר */
{
  const pos = [
    { symbol: 'AA', asset: 'STK', qty: 100, currency: 'USD', isin: 'US0000000001', markPrice: 400 },
    { symbol: 'BB', asset: 'STK', qty: 100, currency: 'USD', isin: 'IE0000000002', markPrice: 100 },
    { symbol: 'CC.TA', asset: 'STK', qty: 100, currency: 'ILS', markPrice: 50 },
    { symbol: 'DD', asset: 'STK', qty: 50, currency: 'USD', markPrice: 100 },
    { symbol: 'USD', asset: 'CASH', qty: 9999, currency: 'USD', markPrice: 1 },
  ];
  const e = T.tiEstate(pos, (s) => (s === 'AA' ? 500 : null));
  eq(e.usd, 100 * 500 + 50 * 100, 'G10 שווי אמריקאי (מחיר חי קודם)');
  eq(e.guess, 5000, 'G10 ניחוש בלי ISIN');
  ok(e.n === 2 && !e.over, 'G10 מתחת לסף');
  ok(T.tiEstate([{ symbol: 'AA', asset: 'STK', qty: 200, currency: 'USD', isin: 'US0000000001', markPrice: 400 }]).over, 'G10 מעל 60,000$');
}

console.log('# taxil-golden: ' + n + ' בדיקות עברו');
