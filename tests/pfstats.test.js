// pfstats.test.js — מנוע "ניתוח התיק": סיכון, ירידה מהשיא, בטא, PME, ציון תזמון, איזון דרך הפקדה.
// כל הנתונים פיקטיביים לחלוטין — אסור להכניס נתוני משתמש אמיתיים.
const P = require('../pfstats.js');

let n = 0;
function ok(cond, name) {
  n++;
  if (!cond) { console.error('FAIL - ' + name); process.exit(1); }
  console.log('ok - ' + name);
}
function approx(a, b, eps, name) { ok(typeof a === 'number' && Math.abs(a - b) <= eps, name + ' (קיבלנו ' + a + ', ציפינו ' + b + ')'); }

// עוזר: תאריך ISO אחרי N ימים מ־2020-01-06 (יום שני)
function dayISO(k) { return new Date(Date.UTC(2020, 0, 6) + k * 86400000).toISOString().slice(0, 10); }

/* ---------- CAGR, חלון וקטע יומי ---------- */
approx(P.psCagr([{ date: '2020-01-01', value: 100 }, { date: '2022-01-01', value: 121 }]), 0.1, 0.002, 'CAGR: 100→121 בשנתיים ≈ 10%');
ok(P.psCagr([{ date: '2020-01-01', value: 100 }]) === null, 'CAGR: נקודה אחת — null');
{
  const rows = [{ date: '2019-01-01', value: 100 }, { date: '2019-06-30', value: 104 }];
  for (let k = 0; k < 10; k++) rows.push({ date: dayISO(k), value: 110 + k });
  const seg = P.psDailySegment(rows);
  ok(seg.length === 10 && seg[0].date === dayISO(0), 'קטע יומי: נקודות התקופה הישנות נחתכות');
  ok(P.psWindow(rows, 0).length === 12, 'חלון 0 = הכל');
  ok(P.psWindow(rows, 0.5).every((r) => r.date >= '2019-07-01'), 'חלון חצי שנה מסתיים בתאריך האחרון');
}

/* ---------- ירידה מהשיא ---------- */
{
  const v = [100, 120, 90, 60, 120, 130];
  const dd = P.psDrawdown(v.map((x, i) => ({ date: dayISO(i), value: x })));
  approx(dd.mdd, -0.5, 1e-12, 'ירידה מקסימלית 120→60 = −50%');
  ok(dd.peak === dayISO(1) && dd.trough === dayISO(3), 'תאריכי השיא והשפל');
  ok(dd.recover === dayISO(4), 'חזרה לשיא ביום שבו הערך חזר ל־120');
  ok(dd.days === 3, 'משך הירידה מהשיא עד החזרה: 3 ימים');
  // Ulcer = שורש ממוצע ריבועי הירידות באחוזים: 0,0,−25,−50,0,0
  approx(dd.ulcer, Math.sqrt((625 + 2500) / 6), 1e-9, 'Ulcer Index לפי ההגדרה');
  const noRec = P.psDrawdown([100, 80, 90].map((x, i) => ({ date: dayISO(i), value: x })));
  ok(noRec.recover === null && noRec.days === 2, 'עוד לא חזר לשיא — משך עד היום');
}

/* ---------- כרטיס הסיכון ---------- */
{
  // תשואות יומיות מתחלפות +1% / −0.5%
  const rows = [{ date: dayISO(0), value: 100 }];
  for (let k = 1; k <= 252; k++) rows.push({ date: dayISO(k), value: rows[k - 1].value * (k % 2 ? 1.01 : 0.995) });
  const r = P.psRisk(rows, { rf: 0 });
  const rets = []; for (let k = 1; k <= 252; k++) rets.push(k % 2 ? 0.01 : -0.005);
  const m = rets.reduce((s, x) => s + x, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((s, x) => s + (x - m) * (x - m), 0) / (rets.length - 1));
  approx(r.vol, sd * Math.sqrt(252), 1e-12, 'תנודתיות שנתית = סטיית תקן יומית × √252');
  approx(r.sharpe, m / sd * Math.sqrt(252), 1e-9, 'Sharpe בלי ריבית');
  // Sortino: סטיית צד מטה על כל התצפיות (126 מתוך 252 שליליות)
  const dd = Math.sqrt(126 * 0.005 * 0.005 / 252) * Math.sqrt(252);
  approx(r.sortino, m * 252 / dd, 1e-9, 'Sortino: המכנה על כל התצפיות, לא רק השליליות');
  approx(r.worst, -0.005, 1e-12, 'היום הגרוע');
  approx(r.var95, -0.005, 1e-12, 'VaR 95% היסטורי');
  ok(r.n === 252 && r.from === dayISO(0), 'מספר תצפיות ותאריך התחלה');
  const withRf = P.psRisk(rows, { rf: 0.04 });
  ok(withRf.sharpe < r.sharpe, 'ריבית חסרת סיכון מקטינה את Sharpe');
  ok(P.psRisk(rows.slice(0, 10)) === null, 'פחות מ־20 תצפיות — null');
}

/* ---------- המדד באותם תאריכים ובטא ---------- */
{
  // שורה אחת לשבוע, תשואת התיק = פעמיים תשואת המדד
  const bench = [{ date: dayISO(0), close: 100 }], port = [{ date: dayISO(0), value: 100 }];
  for (let k = 1; k <= 60; k++) {
    const br = (k % 3 === 0 ? -0.02 : 0.015);
    bench.push({ date: dayISO(7 * k), close: bench[k - 1].close * (1 + br) });
    port.push({ date: dayISO(7 * k), value: port[k - 1].value * (1 + 2 * br) });
  }
  const b = P.psBeta(port, bench);
  approx(b.beta, 2, 1e-9, 'בטא = 2 כשהתיק זז פי שניים מהמדד');
  approx(b.corr, 1, 1e-9, 'מתאם מלא');
  ok(b.lo <= 2 + 1e-9 && b.hi >= 2 - 1e-9 && b.n === 60, 'טווח 95% סביב הבטא');
  const br = P.psBenchRows(port, bench);
  ok(br.length === port.length && br[5].value === bench[5].close, 'המדד מיושר לתאריכי התיק');
  ok(P.psCloseOn(bench, dayISO(8)) === bench[1].close, 'סגירה ביום המסחר הקודם');
}

/* ---------- PME ---------- */
{
  const hist = [
    { date: '2020-01-01', close: 100 }, { date: '2021-01-01', close: 200 },
    { date: '2022-01-01', close: 400 }, { date: '2023-01-01', close: 400 },
  ];
  // שתי הפקדות של 100, שווי היום 700
  const flows = [{ d: '2020-01-01', amt: -100 }, { d: '2021-01-01', amt: -100 }, { d: '2023-01-01', amt: 700 }];
  const p = P.psPme(flows, hist);
  approx(p.index, 600, 1e-9, 'PME: אותן הפקדות במדד = 400 + 200');
  approx(p.diff, 100, 1e-9, 'יתרון התיק על המדד');
  approx(p.ks, 700 / 600, 1e-12, 'יחס Kaplan-Schoar');
  ok(p.plus === null && p.contributed === 200, 'בלי משיכות אין λ של PME+');
  ok(p.curve.length === 4 && Math.abs(p.curve[1].value - 300) < 1e-9 && Math.abs(p.curve[3].value - 600) < 1e-9, 'עקומת המדד: 1.5 יחידות × 200 = 300, ובסוף × 400 = 600');
  // עם משיכה של 100 כשהמדד ב־400
  const f2 = [{ d: '2020-01-01', amt: -100 }, { d: '2022-01-01', amt: 100 }, { d: '2023-01-01', amt: 250 }];
  const p2 = P.psPme(f2, hist);
  approx(p2.index, 300, 1e-9, 'PME עם משיכה: 400 − 100');
  approx(p2.ks, (100 + 250) / 400, 1e-12, 'KS-PME עם משיכה');
  approx(p2.plus, (400 - 250) / 100, 1e-12, 'λ של PME+');
  ok(P.psPme([{ d: '2019-01-01', amt: -100 }, { d: '2023-01-01', amt: 200 }], hist) === null, 'אין מדד מתחילת התיק — לא ממציאים');
}

/* ---------- ציון התזמון ---------- */
{
  const rows = [{ date: '2020-01-01', value: 100 }, { date: '2021-01-01', value: 80 }, { date: '2022-01-01', value: 121 }];
  const t = P.psTiming(14, rows, [{ d: '2020-01-01', amt: -100 }, { d: '2021-01-01', amt: -300 }, { d: '2022-01-01', amt: 500 }]);
  approx(t.twr, 0.1, 0.002, 'TWR שנתי מהמדד');
  approx(t.gap, 0.04, 0.002, 'פער = XIRR − TWR');
  ok(t.items.length === 2 && t.items[0].d === '2021-01-01', 'ההפקדה שנכנסה בשפל תרמה הכי הרבה');
  ok(t.items[0].edge > 0, 'הפקדה בשפל = יתרון חיובי');
  ok(P.psTiming(null, rows, []) === null, 'בלי XIRR — null');
}

/* ---------- איזון דרך הפקדה ---------- */
{
  const H = [{ key: 'A', value: 600 }, { key: 'B', value: 300 }, { key: 'C', value: 100, price: 30 }];
  const T = { A: 0.5, B: 0.3, C: 0.2 };
  const r = P.psRebalance(H, T, 200);
  const by = Object.fromEntries(r.lines.map((l) => [l.key, l.amount]));
  ok(!by.A && Math.abs(by.B - 60) < 1e-6 && Math.abs(by.C - 140) < 1e-6, 'כסף מספיק — כל נכס מקבל את החוסר שלו');
  ok(r.maxDevAfter < 1e-6, 'אחרי ההפקדה — בדיוק ביעד');
  const r2 = P.psRebalance(H, T, 100);
  ok(r2.lines.length === 1 && r2.lines[0].key === 'C' && Math.abs(r2.lines[0].amount - 100) < 1e-6, 'מילוי מים: הכסף הולך לנכס הכי רחוק מהיעד');
  ok(r2.maxDevAfter < r2.maxDevBefore, 'הסטייה המקסימלית יורדת');
  const r3 = P.psRebalance(H, T, 100, { whole: true });
  ok(r3.lines[0].units === 3 && Math.abs(r3.leftover - 10) < 1e-9, 'יחידות שלמות: 3 × 30, נשארים 10');
  const r4 = P.psRebalance(H, T, 100, { minTrade: 150 });
  ok(r4.lines.length === 0 && r4.leftover === 100, 'קנייה קטנה מהמינימום מדולגת');
  ok(P.psRebalance(H, {}, 100) === null && P.psRebalance(H, T, 0) === null, 'בלי יעד או בלי כסף — null');
  const r5 = P.psRebalance([], { A: 1, B: 1 }, 100);
  ok(Math.abs(r5.target.A - 0.5) < 1e-12 && r5.lines.length === 2, 'יעדים מנורמלים לסכום 1; תיק ריק');
}

/* ---------- כלל 5/25 ---------- */
{
  const d = P.psDrift({ A: 0.64, B: 0.13, C: 0.23 }, { A: 0.6, B: 0.1, C: 0.3 });
  const by = Object.fromEntries(d.map((x) => [x.key, x]));
  ok(!by.A.over, '4 נקודות מעל יעד של 60% — בתוך הסף');
  ok(by.B.over, '3 נקודות מעל יעד של 10% — מעל 25% יחסי');
  ok(by.C.over && d[0].key === 'C', '7 נקודות מתחת — חריגה, ובראש הרשימה');
}

console.log('# pfstats: ' + n + ' בדיקות עברו');
