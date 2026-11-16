/* תיק אקמן — מחולל הספר (ibkr-proxy/lib/ackmanbook.js + ackmanbuild.js), 16/11/2026.
   תרחיש סינתטי שמכסה את כל הכללים עד הסנט: פתיחה בסוף הרבעון הראשון, עסקה נאמדת ב־VWAP, עסקה מדויקת (Form 4) שגוברת,
   דיבידנד ביום האקס עם מס במקור, משיכת המזומן בסוף רבעון, ספליט, ספינאוף ומיזוג (מניות + מזומן) — ושהשווי בסוף כל רבעון
   = שווי ה־13F. ובנוסף בדיקות על הנתונים האמיתיים (ackman-13f.json). */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const B = require(path.join(ROOT, 'ibkr-proxy/lib/ackmanbook.js'));
const AB = require(path.join(ROOT, 'ibkr-proxy/lib/ackmanbuild.js'));
const D13 = require(path.join(ROOT, 'ibkr-proxy/lib/ackman-13f.json'));

let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 0.005 : e);

// ---------- עזר טהור ----------
ok(B.isinFrom('594918104', 'US') === 'US5949181045' && B.isinFrom('02079K107', 'US') === 'US02079K1079', 'ISIN מ־CUSIP (ספרת ביקורת, גם עם אות)');
ok(B.isinFrom('', 'US') === '' && B.isinFrom('12345', 'US') === '', 'CUSIP לא תקין → בלי ISIN');
ok(B.fmtRatio(1.5) === '3 FOR 2' && B.fmtRatio(0.1) === '1 FOR 10' && B.fmtRatio(4.25) === '17 FOR 4' && B.fmtRatio(2) === '2 FOR 1', 'יחס כטקסט כמו ב־IBKR');
const P0 = { wht: { US: [[2004, 0.12], [2015, 0.21]], CA: [[2004, 0.19]], default: [[2004, 0.3]] } };
ok(B.whtRate(P0, 'US', '2014-06-01') === 0.12 && B.whtRate(P0, 'US', '2015-01-02') === 0.21 && B.whtRate(P0, 'GB', '2020-01-01') === 0.3 && B.whtRate({}, 'US', '2020-01-01') === 0, 'מס במקור לפי מדינה ושנה (ברירת מחדל, בלי טבלה = 0)');

// ---------- Yahoo: ביטול ההתאמה לספליט ----------
{
  const t = (iso) => Date.parse(iso + 'T13:30:00Z') / 1000;   // 9:30 בניו יורק
  const j = { chart: { result: [{ meta: { currency: 'USD', gmtoffset: -14400 }, timestamp: [t('2020-05-13'), t('2020-05-14'), t('2020-05-15')],
    indicators: { quote: [{ close: [50, 51, 51], high: [50, 51, 52], low: [50, 51, 50], volume: [200, 200, 100] }] },
    events: { splits: { a: { date: t('2020-05-15'), numerator: 2, denominator: 1 } }, dividends: { b: { date: t('2020-05-13'), amount: 0.5 } } } }] } };
  const s = B.seriesFromYahoo(j);
  ok(s.d.join() === '2020-05-13,2020-05-14,2020-05-15' && s.c.join() === '100,102,51', 'מחיר שנסחר באמת (לפני הספליט ×2), תאריך לפי שעון ניו יורק');
  ok(s.v.join() === '100,100,100' && s.div[0][0] === '2020-05-13' && s.div[0][1] === 1, 'מחזור ודיבידנד — גם הם בלי ההתאמה');
}

// ---------- VWAP ----------
{
  const s = { d: ['2020-01-01', '2020-01-02', '2020-01-03', '2020-01-06'], c: [10, 11, 14, 99], h: [10, 12, 15, 99], l: [10, 10, 13, 99], v: [1000, 100, 300, 5] };
  const w = B.vwapWindow(s, '2020-01-01', '2020-01-03');
  const want = (11 * 100 + 14 * 300) / 400;   // מחיר טיפוסי (גבוה+נמוך+סגירה)/3 — 11 ו־14
  ok(near(w.vwap, want, 1e-9) && w.days === 2, 'VWAP של החלון (from, to] — בלי היום הראשון, עם האחרון');
  ok(w.date === '2020-01-03' && w.close === 14, 'יום העסקה = הסגירה הקרובה ביותר לממוצע');
  ok(B.vwapWindow(s, '2020-01-06', '2020-02-01') === null && B.vwapWindow(null, 'a', 'b') === null, 'חלון בלי ימי מסחר → null');
}

// ---------- תרחיש מלא ----------
const cal = [];
for (let t = Date.parse('2019-12-02T00:00:00Z'); t <= Date.parse('2020-10-02T00:00:00Z'); t += 864e5) { const d = new Date(t); if (d.getUTCDay() > 0 && d.getUTCDay() < 6) cal.push(d.toISOString().slice(0, 10)); }
const series = (pxOf, div, from, to) => {
  const d = cal.filter((x) => (!from || x >= from) && (!to || x <= to));
  const c = d.map(pxOf);
  return { d, c, h: c.slice(), l: c.slice(), v: d.map(() => 1000), div: div || [], cur: 'USD' };
};
const px = {
  SPY: series(() => 300),
  AAA: series((d) => (d <= '2020-03-31' ? 10 : 12), [['2020-02-14', 0.5]]),
  BBB: series((d) => (d < '2020-05-15' ? 50 : d < '2020-08-03' ? 25 : 20)),
  CCC: series(() => 10, null, '2020-08-03', '2020-09-14'),
  DDD: series(() => 16),   // תנאי מיזוג שווי ערך: CCC ‏10$ = חצי DDD ‏(8$) + ‏2$ מזומן
};
const Q = (period, rows) => ({ period, filed: '', acc: [], rows: rows.map(([sym, shares, value]) => ({ sym, shares, value })) });
const book = B.buildBook({
  quarters: [
    Q('2019-12-31', [['AAA', 1000, 10000]]),
    Q('2020-03-31', [['AAA', 1500, 15000], ['BBB', 200, 10000]]),
    Q('2020-06-30', [['BBB', 400, 10000]]),                       // AAA נמכרה; BBB — ספליט 2:1, לא קנייה
    Q('2020-09-30', [['BBB', 400, 8000], ['DDD', 100, 1600]]),    // CCC יצאה מ־BBB ומוזגה ל־DDD
  ],
  exact: [{ date: '2020-02-03', sym: 'BBB', qty: 50, price: 48, src: 'Form 4', url: 'https://www.sec.gov/x' }],
  actions: [
    { date: '2020-05-15', type: 'split', sym: 'BBB', ratio: 2 },
    { date: '2020-08-03', type: 'spinoff', sym: 'BBB', to: 'CCC', ratio: 0.5 },
    { date: '2020-09-15', type: 'merger', sym: 'CCC', to: 'DDD', ratio: 0.5, cash: 2 },
  ],
  px, info: { AAA: { name: 'Alpha', country: 'US', isin: 'US0000000001' } },
  params: { asOf: '2020-09-30', commission: { perShare: 0.01 }, wht: { US: [[2004, 0.12], [2015, 0.21]] } },
});
const T = book.trades;
ok(T.length === 5 && book.ackman.warn.length === 0, 'חמש עסקאות, בלי אזהרות');
ok(T[0].date === '2019-12-31' && T[0].symbol === 'AAA' && T[0].qty === 1000 && T[0].price === 10 && T[0].commission === -10 && T[0].how === 'open' && T[0].est, 'רבעון ראשון: פתיחה בסגירה של סוף הרבעון');
ok(T[1].date === '2020-01-01' && T[1].symbol === 'AAA' && T[1].qty === 500 && T[1].how === 'vwap' && T[2].symbol === 'BBB' && T[2].qty === 150 && T[2].price === 50, 'השארית ברבעון — עסקה נאמדת אחת ב־VWAP (BBB: ‏200 פחות 50 המדויקות)');
ok(T[3].date === '2020-02-03' && T[3].qty === 50 && T[3].price === 48 && !T[3].est && T[3].src === 'Form 4' && T[3].url, 'עסקה מדויקת גוברת — תאריך, כמות, מחיר ומקור');
ok(T[4].date === '2020-04-01' && T[4].qty === -1500 && T[4].price === 12 && T[4].side === 'SELL' && T[4].realized === 2970, 'מכירה: רווח ממומש FIFO כולל עמלות (17,985 − 15,015)');
ok(T[0].description === 'Alpha' && T[0].isin === 'US0000000001' && T[0].tradeId === 'PS1' && T[0].netCash === -10010, 'שדות כמו בדוח IBKR');

const C = book.cashTransactions;
const dep = C.filter((c) => c.type === 'Deposits/Withdrawals').map((c) => c.amount);
ok(dep.join() === '10010,5005,7501.5,2400.5,-592.5,-17985,-400', 'הפקדה בכל קנייה בלי מזומן; משיכת המזומן בסוף כל רבעון');
const dv = C.find((c) => c.type === 'Dividends'), wt = C.find((c) => c.type === 'Withholding Tax');
ok(dv && dv.date === '2020-02-14' && dv.amount === 750 && dv.qty === 1500 && wt.amount === -157.5 && wt.rate === 0.21 && wt.est, 'דיבידנד ביום האקס על 1,500 מניות, מס במקור 21%');
ok(/^AAA\(US0000000001\) Cash Dividend USD 0\.5 per Share/.test(dv.description), 'תיאור הדיבידנד בצורת IBKR (עם ISIN)');

const qs = book.ackman.quarters;
ok(qs.length === 4 && qs.every((q) => near(q.nav, q.total)), 'השווי בסוף כל רבעון = שווי ה־13F (10K, 25K, 10K, 9.6K)');
ok(JSON.stringify(qs[1].d) === '[["AAA",1000,1500],["BBB",0,200]]' && JSON.stringify(qs[2].d) === '[["AAA",1500,0]]' && qs[3].d.length === 0, '"מה השתנה": ספליט, ספינאוף ומיזוג — לא קנייה ולא מכירה');
ok(JSON.stringify(qs[1].h[0]) === '["AAA",1500,15000]', 'האחזקות כפי שדווחו, מהגדולה');

const fs = book.taxEvents.map((e) => e.type + ':' + e.symbol + ':' + e.qty).join();
ok(fs === 'FS:BBB:200,SO:CCC:200,TC:CCC:-200,TC:DDD:100', 'פעולות תאגידיות כמו מקטע CorporateAction של IBKR');
const tc = book.taxEvents.find((e) => e.type === 'TC' && e.symbol === 'CCC');
ok(tc.proceeds === 400 && /CCC\(\) MERGED \(DDD 1 FOR 2\) \+ 2 USD/.test(tc.description), 'מיזוג: המזומן (2$ למניה) בפעולה');
const alloc = Object.values(book.caAlloc);
ok(alloc[0] === 20 && alloc[1] === 80, 'חלוקת העלות: ספינאוף לפי השווי ביום הראשון (20%); מיזוג — החלק במניות (80%)');
ok(book.ackman.realizedCa.length === 1 && book.ackman.realizedCa[0].sym === 'CCC' && book.ackman.realizedCa[0].realized === 3.92, 'מיזוג: רווח ממומש על חלק המזומן בלבד (400 − 20% מ־1,980.40)');

const pos = book.positions;
ok(pos.length === 2 && pos[0].symbol === 'BBB' && pos[0].qty === 400 && pos[0].marketValue === 8000 && near(pos[0].costBasis, 7921.6), 'BBB: הכמות אחרי הספליט, העלות אחרי הספינאוף (80%)');
ok(pos[1].symbol === 'DDD' && pos[1].qty === 100 && near(pos[1].costBasis, 1584.32), 'DDD: יורשת את עלות CCC פחות חלק המזומן (80%)');
ok(book.cashBalances[0].balance === 0 && book.meta.fromDate === '2019-12-31' && book.meta.toDate === '2020-09-30', 'מזומן 0 בסוף; תקופת הספר');

const nh = book.navHistory;
const twr2 = ((22500 - 12506.5) / 10000 * (25000 - 2400.5) / 22500 * 25592.5 / 25000 * (25000 + 592.5) / 25592.5 - 1) * 100;
ok(nh.length === 3 && near(nh[0].twr, twr2, 1e-4) && nh[0].flows === 14314.5, 'TWR רבעוני משורשר יומית, בלי ההפקדות והמשיכות (Q1 2020: ‏+2.7559%)');
ok(near(nh[1].twr, (1500 * 2 - 15) / 25000 * 100, 1e-4) && nh[1].flows === -17985, 'Q2 2020: רק עליית AAA פחות העמלה — הספליט לא "קופץ"');
ok(near(nh[2].twr, 0, 1e-9), 'ספינאוף ומיזוג בתנאים שווי ערך → תשואה 0');
ok(book.navDaily[0].date === '2019-12-31' && book.navDaily[book.navDaily.length - 1].total === 9600, 'שווי יומי מתחילת הספר ועד היום');

// ---------- הנתונים האמיתיים ----------
const last = D13.quarters[D13.quarters.length - 1];
ok(D13.quarters.length >= 83 && D13.quarters[0].p === '2005-12-31', 'כל ה־13F מאז 31/12/2005');
ok(last.p >= '2026-06-30' && (last.p !== '2026-06-30' || last.h.reduce((t, r) => t + r[2], 0) === 18672762772), 'Q2 2026: סך הקרנות $18,672,762,772 (בלי 9M HHH ו־4M PSUS של חברת הניהול)');
ok(!D13.quarters.some((q) => q.h.some((r) => r[0] === 'PSUS')), 'מניות PSUS של חברת הניהול — לא בתיק');
const pg = AB.qFrom(D13.quarters.find((q) => q.p === '2013-06-30'), D13.symbols);
ok(pg.rows.find((r) => r.sym === 'PG').shares === 8940133 && pg.calls.length === 1 && pg.calls[0].shares === 25000000, 'CALL לא נכנס לכמות (P&G ‏Q2 2013: ‏8.94M מניות, לא 33.9M)');
ok(D13.quarters.every((q) => q.h.every((r) => r[1] > 0 && r[2] >= 0)), 'כל השורות עם כמות חיובית');
const syms = AB.neededSymbols(D13, null, '2015-06-30');
ok(syms[0] === 'SPY' || syms.includes('SPY'), 'המחירים הנדרשים כוללים את לוח ימי המסחר (SPY)');

console.log('\n' + n + ' בדיקות עברו');
