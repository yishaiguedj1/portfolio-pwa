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

/* G11–G15 — חמש הדוגמאות של פס״ד מוזס (ע״א 3555/15, פס׳ 26; דנ״א 7517/16 נדחה). קנייה 1 × $100 בשער 5 = 500 ₪.
   N = מכירה$ × שער − 500; D = (מכירה$ − 100) × שער.
   G11 $150/7: N 550, D 350 → 350 · G12 $50/11: N 50, D −550 → 0 · G13 $50/7: N −150, D −350 → −150
   G14 $200/3: N 100, D 300 → 100 · G15 $50/3: N −350, D −150 → −150 */
for (const [g, p, r, want] of [['G11', 150, 7, 350], ['G12', 50, 11, 0], ['G13', 50, 7, -150], ['G14', 200, 3, 100], ['G15', 50, 3, -150]]) {
  const f = T.tiFifo([tr('M', '2010-01-04', 1, 100, 0, 1), tr('M', '2015-01-05', -1, p, 0, 2)], fxFrom({ '2010-01-04': 5, '2015-01-05': r }));
  eq(f.sales[0].taxable, want, g + ' מוזס: $' + p + ' בשער ' + r);
}

/* G21 — ריבית מרווח לא מנוכה (101א(ב)). באותו יום, בשער 3.7: דיבידנד +$100 (ארה״ב), ניכוי −$25, Broker Interest Paid −$40.
   דיבידנד 370, ניכוי 92.5 → מס ישראלי 92.5, זיכוי 92.5, יתרה 0, אין עודף. בסיס היסף 370. ריבית המרווח 148 — מידע בלבד. */
{
  const cash = [
    { date: '2025-03-03', type: 'Dividends', amount: 100, currency: 'USD', description: 'AA(US0000000001) Cash Dividend USD 1.00 per Share' },
    { date: '2025-03-03', type: 'Withholding Tax', amount: -25, currency: 'USD', description: 'AA(US0000000001) Cash Dividend USD 1.00 per Share - US Tax' },
    { date: '2025-03-03', type: 'Broker Interest Paid', amount: -40, currency: 'USD', description: 'USD DEBIT INT FOR FEB-2025' },
  ];
  const divs = T.tiDividends(cash, () => 3.7);
  const Y = T.tiYear(2025, [], divs, { other: 0 });
  eq(Y.div.gross, 370, 'G21 ברוטו דיבידנד');
  eq(Y.interest.gross, 0, 'G21 ריבית ששולמה אינה הכנסה שלילית');
  eq(Y.extraInc, 0, 'G21 אין יתרה');
  eq(Y.creditLost, 0, 'G21 אין עודף זיכוי מדומה');
  eq(Y.marginInt, 148, 'G21 ריבית המרווח מוצגת');
  ok(Y.flags.includes('marginInt'), 'G21 דגל ריבית מרווח');
}

/* G22 — זיכוי לכל מקור (199, 204(ב)). בשער 3.5: דיבידנד $1,000 (ארה״ב) עם ניכוי 30% = 3,500 / 1,050; ריבית זכות $1,000 = 3,500 / 0.
   דיבידנד: מס 875, זיכוי 875, עודף 175 (כולו מעל 25% → החזר מה־IRS, לא למאגר). ריבית: מס 875, זיכוי 0. מס נוסף 875. */
{
  const divs = [
    { date: '2025-04-01', kind: 'dividend', country: 'US', grossIls: 3500, whIls: 1050 },
    { date: '2025-04-01', kind: 'interest', country: '', grossIls: 3500, whIls: 0 },
  ];
  const Y = T.tiYear(2025, [], divs, { other: 0 });
  eq(Y.extraInc, 875, 'G22 מס נוסף 875 (ולא 700)');
  eq(Y.irsRefund, 175, 'G22 העודף מעל 25% — להחזר מה־IRS');
  eq(Y.poolAdded, 0, 'G22 לא נכנס למאגר');
}

/* G24 — מקדמה מצטברת (91(ד)(2ג)(ב)). ינואר–יוני נטו −1,000; יולי–דצמבר +3,000.
   31/7: 0. 31/1: 3,000 − 1,000 − 0 = 2,000 → מס 500 (ולא 750). */
{
  const s = T.tiSemi([{ sellDate: '2025-03-01', taxable: -1000 }, { sellDate: '2025-09-01', taxable: 3000 }], 2025);
  eq(s.h1, 0, 'G24 מחצית ראשונה');
  eq(s.h2 * 0.25, 500, 'G24 מחצית שנייה — 500');
}

/* G25 — מס יסף עם הכנסה הונית אחרת (121ב(א1), 2025).
   עבודה 400,000, רווח 1,100,000: 3% × 778,440 = 23,353.2; 2% × 378,440 = 7,568.8 → 30,922.
   הונית אחרת 300,000, רווח 500,000, עבודה 0: 3% × 78,440 + 2% × 78,440 = 3,922.
   הוני 500,000 + עבודה 500,000: 3% × 278,440 = 8,353.2, ו־2% = 0. */
{
  eq(T.tiYear(2025, [{ sellDate: '2025-04-01', taxable: 1100000 }], [], { other: 400000 }).surtax, 30922, 'G25 עבודה + הון');
  eq(T.tiYear(2025, [{ sellDate: '2025-04-01', taxable: 500000 }], [], { other: 0, otherCap: 300000 }).surtax, 3922, 'G25 הונית אחרת בשכבת ה־2%');
  eq(T.tiYear(2025, [{ sellDate: '2025-04-01', taxable: 500000 }], [], { other: 500000 }).surtax, 8353.2, 'G25 בלי 2% כשההון מתחת לסף');
}

/* G27 — מאגר עודף זיכוי (205א). הקלט של G5 (הפסד 1,000, דיבידנד 370 עם ניכוי 92.5, לא מארה״ב) → עודף 92.5 למאגר.
   2026: דיבידנד 400 בלי ניכוי → מס 100 − 92.5 מהמאגר = 7.5 (הערכה: נומינלי, בלי הצמדה). 2031 — פקע. */
{
  const sales = [{ sellDate: '2025-05-01', taxable: -1000 }];
  const divs = [{ date: '2025-06-01', kind: 'dividend', country: 'IE', grossIls: 370, whIls: 92.5 }, { date: '2026-06-01', kind: 'dividend', country: 'IE', grossIls: 400, whIls: 0 }];
  const ys = T.tiYears(sales, divs, {});
  eq(ys[0].poolAdded, 92.5, 'G27 2025 נכנס למאגר');
  eq(ys[1].extraInc, 7.5, 'G27 2026 ניצול מהמאגר');
  ok(ys[1].flags.includes('creditCarry'), 'G27 מסומן "הערכה"');
  const late = T.tiYear(2031, [], [{ date: '2031-06-01', kind: 'dividend', grossIls: 400, whIls: 0 }], { pool: ys[0].poolOut });
  eq(late.extraInc, 100, 'G27 אחרי 5 שנים — פקע');
}

/* G16 — אופציה עם מכפיל (✗4): הערך מ־tradeMoney, לא כמות × מחיר.
   קנייה 2 חוזים × $3.00 × 100 + $1.30 בשער 3.6 → עלות $601.30. מכירה 2 × $5.00 × 100 − $1.30 בשער 3.7 → תמורה $998.70.
   N = 998.70·3.7 − 601.30·3.6 = 3,695.19 − 2,164.68 = 1,530.51. D = 397.40·3.7 = 1,470.38 → חייב 1,470.38 (לפני התיקון: 5.18) */
{
  const o = (date, qty, price, money, id) => Object.assign(tr('OPT', date, qty, price, 1.3, id), { multiplier: 100, tradeMoney: money, asset: 'OPT' });
  const f = T.tiFifo([o('2025-01-02', 2, 3, 600, 1), o('2025-02-03', -2, 5, -1000, 2)], fxFrom({ '2025-01-02': 3.6, '2025-02-03': 3.7 }));
  eq(f.sales[0].cost, 601.3, 'G16 עלות כולל מכפיל');
  eq(f.sales[0].gIls, 1530.51, 'G16 בשקלים');
  eq(f.sales[0].taxable, 1470.38, 'G16 חייב');
  // בלי tradeMoney/proceeds — כמות × מחיר × מכפיל
  const g = T.tiFifo([o('2025-01-02', 2, 3, 0, 1), o('2025-02-03', -2, 5, 0, 2)], fxFrom({ '2025-01-02': 3.6, '2025-02-03': 3.7 }));
  eq(g.sales[0].taxable, 1470.38, 'G16 נפילה למכפיל');
}

/* G19 — עסקה שבוטלה (✗7). קנייה 10 × $100 (id 1, שער 3.5), ביטול "BUY (Ca.)" עם origTradeID=1, עסקה מתוקנת 10 × $101 (id 3).
   מכירה 10 × $120 בשער 3.6. N = 4,320 − 3,535 = 785. D = 190·3.6 = 684 → שורת 1325 אחת, חייב 684 */
{
  const cx = Object.assign(tr('G', '2024-01-02', -10, 100, 0, 2), { side: 'BUY (Ca.)', origTradeId: '1' });
  const f = T.tiFifo([tr('G', '2024-01-02', 10, 100, 0, 1), cx, tr('G', '2024-01-02', 10, 101, 0, 3), tr('G', '2025-01-02', -10, 120, 0, 4)],
    fxFrom({ '2024-01-02': 3.5, '2025-01-02': 3.6 }));
  ok(f.sales.length === 1 && !f.open.length && !f.issues.length, 'G19 מכירה אחת, בלי מנה כפולה');
  eq(f.sales[0].gIls, 785, 'G19 בשקלים');
  eq(f.sales[0].taxable, 684, 'G19 חייב');
}

/* G20 — המרת מט״ח מסוננת (✗6). USD.ILS (CASH): קנייה 10,000 בשער 3.6 (36,000 ₪), מכירה 10,000 בשער 3.7 (37,000 ₪).
   צפוי: 0 מכירות ו־0 מנות במנוע; הפרש השער 1,000 ₪ ב־fx (פטור — דגל) */
{
  const c = (date, qty, px, id) => ({ symbol: 'USD.ILS', asset: 'CASH', date: date, qty: qty, price: px, tradeMoney: -qty * px, currency: 'ILS', tradeId: String(id) });
  const f = T.tiFifo([c('2025-01-02', 10000, 3.6, 1), c('2025-03-02', -10000, 3.7, 2)], () => null);
  ok(!f.sales.length && !f.open.length && !f.issues.length, 'G20 לא במנוע');
  eq(f.fx[0].gIls, 1000, 'G20 הפרש השער');
}

/* G23 — תיקון דיבידנד בשנה הבאה (✗5). 15/12/2025, שער 3.6: דיבידנד $100, ניכוי $30. 10/1/2026, שער 3.7: ביטול
   (−100 דיבידנד, +30 ניכוי) ורישום מחדש (+100, ניכוי −25), הכול עם אותו actionId.
   ביד: אירוע אחד בתאריך המקורי ובשער 3.6 — ברוטו 100−100+100 = $100 → 360 ₪; ניכוי 30−30+25 = $25 → 90 ₪ (25%).
   W-8BEN: 25% — אין התראה. 2026: אין דיבידנד ואין ניכוי שלילי, ולכן אין extraInc פיקטיבי. */
{
  const fxOf = (cur, d) => (d < '2026-01-01' ? 3.6 : 3.7);
  const D = 'AAPL(US0378331005) Cash Dividend USD 0.25 per Share';
  const W = 'AAPL(US0378331005) Cash Dividend USD 0.25 per Share - US Tax';
  const rows = (aid) => [
    { type: 'Dividends', date: '2025-12-15', amount: 100, currency: 'USD', description: D, actionId: aid },
    { type: 'Withholding Tax', date: '2025-12-15', amount: -30, currency: 'USD', description: W, actionId: aid },
    { type: 'Dividends', date: '2026-01-10', amount: -100, currency: 'USD', description: D, actionId: aid },
    { type: 'Withholding Tax', date: '2026-01-10', amount: 30, currency: 'USD', description: W, actionId: aid },
    { type: 'Dividends', date: '2026-01-10', amount: 100, currency: 'USD', description: D, actionId: aid },
    { type: 'Withholding Tax', date: '2026-01-10', amount: -25, currency: 'USD', description: W, actionId: aid },
  ];
  const divs = T.tiDividends(rows('9001'), fxOf);
  eq(divs.length, 1, 'G23 אירוע אחד');
  const Y5 = T.tiYear(2025, [], divs, { other: 0 }), Y6 = T.tiYear(2026, [], divs, { other: 0 });
  eq(Y5.div.gross, 360, 'G23 2025 ברוטו 360');
  eq(Y5.div.wh, 90, 'G23 2025 ניכוי 90');
  eq(T.tiW8(divs).length, 0, 'G23 בלי התראת W-8BEN');
  eq(Y6.div.gross, 0, 'G23 2026 אין ברוטו');
  eq(Y6.div.wh, 0, 'G23 2026 אין ניכוי שלילי');
  eq(Y6.extraInc, 0, 'G23 2026 אין מס פיקטיבי');
  // נפילה בלי actionId: המפתח הישן (תאריך+סימבול+מטבע) — שתי רשומות, כמו לפני שלב 5
  const old = T.tiDividends(rows(''), fxOf);
  eq(old.length, 2, 'G23 בלי actionId — שתי רשומות לפי תאריך');
  eq(old[0].wh, 30, 'G23 בלי actionId — 2025 ניכוי $30');
  eq(old[1].gross, 0, 'G23 בלי actionId — 2026 ברוטו 0');
  ok(old.every((d) => !d.actionId), 'G23 בלי actionId — אין מזהה');
  // actionId שונה לכל דיבידנד באותו יום — לא מתמזגים
  const two = T.tiDividends([
    { type: 'Dividends', date: '2025-06-01', amount: 10, currency: 'USD', description: D, actionId: 'a1' },
    { type: 'Dividends', date: '2025-06-01', amount: 20, currency: 'USD', description: D, actionId: 'a2' },
  ], fxOf);
  eq(two.length, 2, 'G23 שני אירועים נפרדים');
}

console.log('# taxil-golden: ' + n + ' בדיקות עברו');
