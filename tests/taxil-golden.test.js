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

/* ---------- שלבים 7–12 (02/11/2026). כל המקרים כאן מסומנים "לא ודאי" במנוע, חוץ מ־G26/G30 ---------- */
const fx36 = fxFrom({ '2024-01-01': 3.5, '2025-01-01': 3.6, '2025-06-01': 3.7 });

/* G17 — פוט שפקעה אצל הקונה (ח2): 1 חוזה × $2 × 100 + עמלה 0.65 = $200.65 בשער 3.6 (2025-03-01); פקיעה (Ep) בשער 3.7.
   N = −200.65·3.6 = −722.34; D = −200.65·3.7 = −742.405 → שני הפסדים, הקטן: −722.34. */
{
  const t = [
    { symbol: 'XYZ   250620P00050000', date: '2025-03-01', qty: 1, price: 2, multiplier: 100, commission: -0.65, currency: 'USD', side: 'BUY', tradeId: '1', asset: 'OPT', openClose: 'O' },
    { symbol: 'XYZ   250620P00050000', date: '2025-06-20', qty: -1, price: 0, multiplier: 100, currency: 'USD', side: 'SELL', tradeId: '2', asset: 'OPT', openClose: 'C', notes: 'Ep' },
  ];
  const f = T.tiFifo(t, fx36);
  eq(f.sales.length, 1, 'G17 מכירה אחת');
  eq(f.sales[0].taxable, -722.34, 'G17 הפסד −722.34');
  ok(f.sales[0].deriv, 'G17 מסומן נגזר');
  ok(T.tiYear(2025, f.sales, [], { other: 0 }).flags.includes('deriv'), 'G17 דגל deriv');
}

/* G18 — פיצול 4:1 (שלב 7). 10 × $400 בשער 3.5 (14,000 ₪); FS: +30 מניות; מכירה 40 × $110 בשער 3.6.
   N = 15,840 − 14,000 = 1,840; D = (4,400 − 4,000)·3.6 = 1,440 → 1,440, בלי noLots ועם תאריך הקנייה המקורי. */
{
  const f = T.tiFifo([tr('ABC', '2024-03-01', 10, 400, 0, 1), tr('ABC', '2025-02-01', -40, 110, 0, 2)], fx36,
    { corp: [{ type: 'FS', symbol: 'ABC', date: '2025-01-10', qty: 30, actionId: 'c1', description: 'ABC SPLIT 4 FOR 1' }] });
  eq(f.sales.length, 1, 'G18 מכירה אחת');
  eq(f.sales[0].taxable, 1440, 'G18 חייב 1,440');
  ok(f.sales[0].buyDate === '2024-03-01', 'G18 תאריך הקנייה המקורי');
  ok(!f.issues.some((i) => i.type === 'noLots'), 'G18 בלי noLots');
  // איחוד 1:4 בשתי שורות (יוצאות 40, נכנסות 10) — אותה עלות כוללת
  const r = T.tiFifo([tr('ABC', '2024-03-01', 40, 100, 0, 1)], fx36,
    { corp: [{ type: 'RS', symbol: 'ABC', date: '2025-01-10', qty: -40, actionId: 'c2' }, { type: 'RS', symbol: 'ABC', date: '2025-01-10', qty: 10, actionId: 'c2' }] });
  eq(r.open[0].qty, 10, 'G18 איחוד — 10 מניות');
  eq(r.open[0].qty * r.open[0].unit, 4000, 'G18 איחוד — העלות נשמרת');
  // שינוי מזהה (IC): הסימבול החדש יורש את המנות
  const ic = T.tiFifo([tr('OLD', '2024-03-01', 5, 100, 0, 1), tr('NEW', '2025-02-01', -5, 120, 0, 2)], fx36,
    { corp: [{ type: 'IC', symbol: 'OLD', date: '2025-01-10', qty: -5, actionId: 'c3' }, { type: 'IC', symbol: 'NEW', date: '2025-01-10', qty: 5, actionId: 'c3' }] });
  eq(ic.sales.length, 1, 'G18 IC — המכירה של NEW מותאמת');
  eq(ic.sales[0].costIls, 1750, 'G18 IC — עלות מקורית');
}

/* פעולות תאגידיות — מחיקה (DW) ו"דורש החלטה" (SO). DW: 10 × $50 בשער 3.5 (עלות 1,750 ₪), מחיקה בשער 3.6:
   N = −1,750; D = −500·3.6 = −1,800 → −1,750. SO: בלי alloc → corpDecide; עם 20%: האם 80% מהעלות, החדש 20%. */
{
  const dw = T.tiFifo([tr('DED', '2024-03-01', 10, 50, 0, 1)], fx36, { corp: [{ type: 'DW', symbol: 'DED', date: '2025-03-01', qty: -10, actionId: 'd1' }] });
  eq(dw.sales[0].taxable, -1750, 'DW הפסד −1,750');
  eq(dw.open.length, 0, 'DW אין מנה פתוחה');
  // ב־Flex מגיעה לרוב שורה אחת (KID +5); האם מזוהה מהתיאור
  const so = [{ type: 'SO', symbol: 'KID', date: '2025-03-01', qty: 5, actionId: 's2', description: 'PAR(US0000000001) SPINOFF 1 FOR 2 (KID)' }];
  const a = T.tiFifo([tr('PAR', '2024-03-01', 10, 100, 0, 1)], fx36, { corp: so });
  ok(a.issues.some((i) => i.type === 'corpDecide' && i.gid === 's2' && i.sym === 'PAR' && i.dst === 'KID'), 'SO בלי הקצאה → corpDecide');
  const b = T.tiFifo([tr('PAR', '2024-03-01', 10, 100, 0, 1)], fx36, { corp: [{ type: 'SO', symbol: 'KID', date: '2025-03-01', qty: 5, actionId: 's9' }] });
  ok(b.issues.some((i) => i.type === 'corpDecide' || i.type === 'corpNoLots'), 'SO בלי תיאור — סימון');
  const c = T.tiFifo([tr('PAR', '2024-03-01', 10, 100, 0, 1)], fx36, { corp: [{ type: 'SO', symbol: 'PAR', date: '2025-03-01', qty: 0, actionId: 's3' }, { type: 'SO', symbol: 'KID', date: '2025-03-01', qty: 5, actionId: 's3' }], alloc: { s3: 20 } });
  const par = c.open.find((l) => l.sym === 'PAR'), kid = c.open.find((l) => l.sym === 'KID');
  eq(par.qty * par.unit, 800, 'SO 20% — האם $800');
  eq(kid.qty * kid.unit, 200, 'SO 20% — החדש $200');
  eq(kid.qty, 5, 'SO 20% — 5 מניות חדשות');
  ok(kid.date === '2024-03-01', 'SO — תאריך הקנייה של האם');
}

/* ח9 — העברה נכנסת: בלי עלות → tinNoCost ובלי מנה; עם עלות $1,000 ותאריך 2024-03-01 (3.5) → מנה של 3,500 ₪. */
{
  const tin = [{ id: 't1', symbol: 'TRF', date: '2025-02-01', qty: 10, currency: 'USD' }];
  const a = T.tiFifo([], fx36, { tin: tin });
  ok(a.issues.some((i) => i.type === 'tinNoCost' && i.id === 't1'), 'ח9 בלי עלות — סימון');
  eq(a.open.length, 0, 'ח9 בלי עלות — אין מנה');
  const b = T.tiFifo([], fx36, { tin: tin, tinCost: { t1: { cost: 1000, date: '2024-03-01' } } });
  eq(b.open[0].qty * b.open[0].unit * b.open[0].fx, 3500, 'ח9 עם עלות — 3,500 ₪');
  ok(b.open[0].date === '2024-03-01', 'ח9 תאריך הקנייה המקורי');
}

/* ח2 — מימוש קול: קנייה 1 × $5 × 100 = $500 בשער 3.5 (1,750 ₪). מימוש (Ex) ב־2025-03-01 (3.6): 100 מניות × $150.
   עלות המניות = 15,000·3.6 + 1,750 = 55,750 ₪. מכירה 100 × $160 ב־2025-04-01 (3.6): 57,600 − 55,750 = 1,850; D = 1,850. */
{
  const t = [
    { symbol: 'AAPL  250620C00150000', date: '2024-06-01', qty: 1, price: 5, multiplier: 100, currency: 'USD', side: 'BUY', tradeId: '1', asset: 'OPT', openClose: 'O' },
    { symbol: 'AAPL  250620C00150000', date: '2025-03-01', qty: -1, price: 0, multiplier: 100, currency: 'USD', side: 'SELL', tradeId: '2', asset: 'OPT', openClose: 'C', notes: 'Ex' },
    tr('AAPL', '2025-03-01', 100, 150, 0, 3), tr('AAPL', '2025-04-01', -100, 160, 0, 4),
  ];
  const f = T.tiFifo(t, fx36);
  eq(f.sales.length, 1, 'ח2 מימוש — רק מכירת המניות');
  eq(f.sales[0].costIls, 55750, 'ח2 מימוש — הפרמיה בעלות');
  eq(f.sales[0].taxable, 1850, 'ח2 מימוש — חייב 1,850');
}

/* G31 — מכירה בחסר (ח3): מכירה 10 × $50 (O) בשער 3.7, כיסוי 10 × $40 בשער 3.5 (2026 — לפי fxFrom).
   N = 1,850 − 1,400 = 450; D לפי שער המכירה = 100·3.7 = 370 → 370, דגל short, בלי מנה פתוחה מדומה. */
{
  const fxs = fxFrom({ '2025-06-01': 3.7, '2025-09-01': 3.5 });
  const t = [
    { symbol: 'SHT', date: '2025-07-01', qty: -10, price: 50, currency: 'USD', side: 'SELL', tradeId: '1', openClose: 'O' },
    { symbol: 'SHT', date: '2025-10-01', qty: 10, price: 40, currency: 'USD', side: 'BUY', tradeId: '2', openClose: 'C' },
  ];
  const f = T.tiFifo(t, fxs);
  eq(f.sales.length, 1, 'G31 מכירה אחת');
  eq(f.sales[0].taxable, 370, 'G31 חייב 370');
  ok(f.sales[0].short && f.issues.some((i) => i.type === 'short'), 'G31 דגל short');
  eq(f.open.length, 0, 'G31 בלי מנה פתוחה מדומה');
  ok(!f.issues.some((i) => i.type === 'noLots'), 'G31 בלי noLots');
}

/* G26 — דמי ניהול (תקנה 6): רווח 2,000; Advisor Fees $50 בשער 3.6 = 180 → חייב 1,820, מס 455.
   שנה בלי מכירות → הפסד 180 שמקזז קודם הכנסה (92(א)(4)) ואז עובר. Other Fees של נתונים → דגל בלבד. */
{
  const fees = T.tiDividends([
    { type: 'Advisor Fees', date: '2025-05-01', amount: -50, currency: 'USD', description: 'Advisor Fee' },
    { type: 'Other Fees', date: '2025-05-01', amount: -10, currency: 'USD', description: 'Market Data Snapshot' },
  ], () => 3.6);
  const sales = [{ sym: 'X', sellDate: '2025-07-01', taxable: 2000, cur: 'USD' }];
  const Y = T.tiYear(2025, sales, fees, { other: 0 });
  eq(Y.taxable, 1820, 'G26 חייב 1,820');
  eq(Y.cgTax, 455, 'G26 מס 455');
  ok(Y.flags.includes('dataFee') && Y.flags.includes('mgmtFee'), 'G26 דגלים');
  const Y0 = T.tiYear(2025, [], fees, { other: 0 });
  eq(Y0.carryOut, 180, 'G26 בלי מכירות — הפסד 180 עובר');
  eq(T.tiReport(2025, [], fees, Y).s1324.length, 0, 'G26 דמי ניהול לא ב־1324');
}

/* G28 — השוואת ריבית מרווח (101א(ב)): רווח 10,000, ריבית מרווח 3,000. בלי ניכוי 2,500; עם ניכוי 30%·7,000 = 2,100 → כדאי. */
{
  const Y = T.tiYear(2025, [{ sym: 'X', sellDate: '2025-07-01', taxable: 10000, cur: 'USD' }], [{ date: '2025-07-01', kind: 'interestPaid', grossIls: -3000, whIls: 0 }], { other: 0 });
  eq(Y.marginCmp.no, 2500, 'G28 בלי ניכוי 2,500');
  eq(Y.marginCmp.deduct, 2100, 'G28 עם ניכוי 2,100');
  ok(Y.marginCmp.better, 'G28 ההמלצה: לנכות');
  eq(Y.due, 2500, 'G28 המס בפועל לא משתנה (השוואה בלבד)');
}

/* G29 — עולה חדש (97(ב)(3)): תושבות 1/1/2020, קנייה 1/1/2015, מכירה 1/1/2035, חייב 100.
   פטור = 100·5,479/7,305 = 75.0034; חייב 24.9966. מכירה ב־2025 (בתוך העשור) → 0. דיבידנד זר בתוך העשור → פטור. */
{
  const R = T.tiResident([
    { sym: 'X', cur: 'USD', country: 'US', buyDate: '2015-01-01', sellDate: '2035-01-01', taxable: 100 },
    { sym: 'Y', cur: 'USD', country: 'US', buyDate: '2015-01-01', sellDate: '2025-01-01', taxable: 100 },
    { sym: 'Z', cur: 'ILS', country: 'IL', buyDate: '2015-01-01', sellDate: '2025-01-01', taxable: 100 },
  ], [{ date: '2025-03-01', kind: 'dividend', country: 'US', grossIls: 100, whIls: 25 }], { date: '2020-01-01' });
  eq(R.sales[0].taxable, 24.9966, 'G29 ליניארי לפי ימים');
  eq(R.sales[1].taxable, 0, 'G29 בתוך העשור — פטור');
  eq(R.sales[2].taxable, 100, 'G29 נייר ישראלי — חייב');
  eq(T.tiYear(2025, R.sales, R.divs, { other: 0 }).div.gross, 0, 'G29 דיבידנד זר פטור');
}

/* G30 — מדרגות עיזבון (§2001(c) פחות $13,000) */
{
  const cases = [[60000, 0], [100000, 10800], [250000, 57800], [500000, 142800], [1000000, 332800], [2000000, 732800]];
  for (const [v, tax] of cases) eq(T.tiEstateTax(v), tax, 'G30 ' + v);
}

/* G32 — קיזוז מול ריבית ממזומן: הפסד 1,000, ריבית 400. מצב א׳ (ברירת מחדל): קיזוז 400, מס 0, עובר 600.
   מצב ב׳ (noOffInt): מס 100 על הריבית, עובר 1,000, ודגל disputed. */
{
  const sales = [{ sym: 'X', sellDate: '2025-07-01', taxable: -1000, cur: 'USD' }];
  const divs = [{ date: '2025-07-01', kind: 'interest', country: '', grossIls: 400, whIls: 0 }];
  const A = T.tiYear(2025, sales, divs, { other: 0 }), B = T.tiYear(2025, sales, divs, { other: 0, noOffInt: true });
  eq(A.offIncome, 400, 'G32 א׳ קיזוז 400');
  eq(A.carryOut, 600, 'G32 א׳ עובר 600');
  eq(B.extraInc, 100, 'G32 ב׳ מס 100');
  eq(B.carryOut, 1000, 'G32 ב׳ עובר 1,000');
  ok(B.flags.includes('disputed'), 'G32 ב׳ דגל disputed');
}

/* ח15 — "הוגש דוח": הפסד 2024 של 1,000 בלי דוח לא עובר ל־2025; רווח 2025 של 500 חייב במלואו. */
{
  const sales = [{ sym: 'X', sellDate: '2024-07-01', taxable: -1000, cur: 'USD' }, { sym: 'X', sellDate: '2025-07-01', taxable: 500, cur: 'USD' }];
  const a = T.tiYears(sales, [], {}), b = T.tiYears(sales, [], { filed: { 2024: false } });
  eq(a[1].taxable, 0, 'ח15 עם דוח — קיזוז');
  eq(b[1].taxable, 500, 'ח15 בלי דוח — אין קיזוז');
  eq(b[0].carryLost, 1000, 'ח15 ההפסד שאבד');
}

/* ח10 — בעל מניות מהותי: רווח 1,000 מ־SUB → 30% = 300. ח13 — המסלול המקוצר: רווח 1,000 והפסד 400 → מלא 150, מקוצר 250. */
{
  const Y = T.tiYear(2025, [{ sym: 'SUB', sellDate: '2025-07-01', taxable: 1000, cur: 'USD' }], [], { other: 0, sub: ['sub'] });
  eq(Y.cgTax, 300, 'ח10 30%');
  const Z = T.tiYear(2025, [{ sym: 'A', sellDate: '2025-07-01', taxable: 1000, cur: 'USD' }, { sym: 'B', sellDate: '2025-07-01', taxable: -400, cur: 'USD' }], [], { other: 0 });
  eq(Z.cgTax, 150, 'ח13 מלא 150');
  eq(Z.shortcut, 250, 'ח13 מקוצר 250');
}

/* ח12 — קריפטו: נכנס למס, לא לשורות 1325; ב־s1399. 205א(ב) (poolCg): מאגר 92.5 מול מס 250 על רווח זר → 157.5. */
{
  const f = T.tiFifo([
    { symbol: 'BTC.USD', date: '2025-02-01', qty: 1, price: 1000, currency: 'USD', side: 'BUY', tradeId: '1', asset: 'CRYPTO' },
    { symbol: 'BTC.USD', date: '2025-03-01', qty: -1, price: 1100, currency: 'USD', side: 'SELL', tradeId: '2', asset: 'CRYPTO' },
  ], fx36);
  const Y = T.tiYear(2025, f.sales, [], { other: 0 });
  const R = T.tiReport(2025, f.sales, [], Y);
  eq(R.s1325.length, 0, 'ח12 לא ב־1325');
  eq(R.s1399.length, 1, 'ח12 ב־1399');
  ok(Y.flags.includes('crypto'), 'ח12 דגל');
  const P = T.tiYear(2026, [{ sym: 'X', sellDate: '2026-07-01', taxable: 1000, cur: 'USD' }], [], { other: 0, poolCg: true, pool: [{ y: 2025, src: 'dividend', amt: 92.5 }] });
  eq(P.due, 157.5, '205א(ב) — המאגר מול רווח זר');
}

/* ---------- 03/11/2026: נייר שקלי ריאלי (88) והצמדת עודף הזיכוי (205א) ---------- */
/* נייר שקלי: קנייה 100 × 100 ₪ (2024-03-01, מדד 100), מכירה (2025-03-01, מדד 104).
   עלות מתואמת 10,400. תמורה 11,000 → ריאלי 600 (נומינלי 1,000). תמורה 10,300 → נומינלי 300, ריאלי −100 → 0.
   תמורה 9,000 → נומינלי −1,000, ריאלי −1,400 → ההפסד הנומינלי −1,000. בלי מדד → נומינלי ומסומן. */
{
  const cpi = (d) => (d < '2025-01-01' ? 100 : 104);
  const ils = (px) => [
    { symbol: 'TA1', date: '2024-03-01', qty: 100, price: 100, currency: 'ILS', side: 'BUY', tradeId: '1' },
    { symbol: 'TA1', date: '2025-03-01', qty: -100, price: px, currency: 'ILS', side: 'SELL', tradeId: '2' },
  ];
  const a = T.tiFifo(ils(110), fx36, { cpi: cpi }).sales[0];
  eq(a.taxable, 600, 'ILS ריאלי 600');
  ok(a.cpiReal && !a.nominal, 'ILS מסומן ריאלי');
  eq(T.tiFifo(ils(103), fx36, { cpi: cpi }).sales[0].taxable, 0, 'ILS אינפלציה בלבד → 0');
  eq(T.tiFifo(ils(90), fx36, { cpi: cpi }).sales[0].taxable, -1000, 'ILS הפסד — הנומינלי');
  const n = T.tiFifo(ils(110), fx36).sales[0];
  ok(n.nominal && n.taxable === 1000, 'ILS בלי מדד — נומינלי ומסומן');
  const u = T.tiUnrealized(T.tiFifo([ils(110)[0]], fx36, { cpi: cpi }).open, () => 110, () => 1, 0, cpi);
  eq(u[0].taxable, 600, 'ILS "אם אמכור היום" — ריאלי');
}

/* 205א — הצמדה: G27 (מאגר 92.5 מ־2025) ומדד 100 בסוף 2025, 104 בסוף 2026 → 96.2 במאגר. דיבידנד 2026 של 400 ₪ בלי ניכוי:
   מס 100 − 96.2 = 3.8 (בלי הצמדה: 7.5). */
{
  const cpi = (d) => (d < '2026-06-01' ? 100 : 104);
  const sales = [{ sym: 'X', sellDate: '2025-07-01', taxable: -1000, cur: 'USD' }];
  const divs = [
    { date: '2025-07-01', kind: 'dividend', country: 'US', grossIls: 370, whIls: 92.5 },
    { date: '2026-07-01', kind: 'dividend', country: 'IE', grossIls: 400, whIls: 0 },
  ];
  eq(T.tiYears(sales, divs, {})[1].extraInc, 7.5, '205א בלי מדד — 7.5');
  eq(T.tiYears(sales, divs, { cpi: cpi })[1].extraInc, 3.8, '205א צמוד — 3.8');
}

/* ח2 — מימוש במזומן (אופציה על מדד): קנייה 1 × $5 × 100 = $500 בשער 3.5; מימוש (Ex) בתמורה $800 בשער 3.6.
   N = 2,880 − 1,750 = 1,130; D = 300·3.6 = 1,080 → 1,080, כמכירה רגילה ובלי optOrphan. */
{
  const f = T.tiFifo([
    { symbol: 'SPX   250620C05000000', date: '2024-06-01', qty: 1, price: 5, multiplier: 100, currency: 'USD', side: 'BUY', tradeId: '1', asset: 'OPT', openClose: 'O' },
    { symbol: 'SPX   250620C05000000', date: '2025-03-01', qty: -1, price: 8, multiplier: 100, tradeMoney: -800, currency: 'USD', side: 'SELL', tradeId: '2', asset: 'OPT', openClose: 'C', notes: 'Ex' },
  ], fx36);
  eq(f.sales.length, 1, 'ח2 מזומן — מכירה');
  eq(f.sales[0].taxable, 1080, 'ח2 מזומן — חייב 1,080');
  ok(!f.issues.some((i) => i.type === 'optOrphan'), 'ח2 מזומן — בלי optOrphan');
}

console.log('# taxil-golden: ' + n + ' בדיקות עברו');
