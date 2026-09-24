// pf-v112.test.js — מנוע תשואות (מיזוג, שרשור TWR, סכומים, XIRR). v128: פארסר ה־CSV הוסר.
// כל הנתונים פיקטיביים לחלוטין — אסור להכניס נתוני משתמש אמיתיים.
const R = require('../returns.js');

let n = 0;
function ok(cond, name) {
  n++;
  if (!cond) { console.error('FAIL - ' + name); process.exit(1); }
  console.log('ok - ' + name);
}
function eq(a, b, name) {
  n++;
  const s1 = JSON.stringify(a), s2 = JSON.stringify(b);
  if (s1 !== s2) { console.error('FAIL - ' + name + '\n  got: ' + s1 + '\n  exp: ' + s2); process.exit(1); }
  console.log('ok - ' + name);
}
function approx(a, b, eps, name) {
  n++;
  if (!(Math.abs(a - b) <= eps)) { console.error('FAIL - ' + name + ' got ' + a + ' exp ' + b); process.exit(1); }
  console.log('ok - ' + name);
}


/* ---------- נתוני דוח סינתטיים (לשעבר מפוענחים מ־CSV; v128: יבוא CSV הוסר —
   המנוע נבדק על אותם נתונים בדיוק, כאובייקט) ---------- */
const FX_A = {"meta": {"fromDate": "2024-01-01", "toDate": "2024-12-31", "baseCurrency": "USD"}, "trades": [{"symbol": "ACME", "date": "2024-02-01", "qty": 10, "side": "BUY", "price": 100, "proceeds": 1000, "commission": 1, "realized": 0, "currency": "USD", "asset": "Stocks", "tradeId": "", "fxToBase": 1}, {"symbol": "ACME", "date": "2024-05-01", "qty": 4, "side": "SELL", "price": 120, "proceeds": -480, "commission": 1, "realized": 80, "currency": "USD", "asset": "Stocks", "tradeId": "", "fxToBase": 1}], "positions": [{"symbol": "ACME", "qty": 6, "asset": "Stocks", "currency": "USD", "markPrice": 121, "marketValue": 726, "costBasis": 600, "unrealized": 126, "levelOfDetail": "SUMMARY", "fxToBase": 1}], "cashTransactions": [{"date": "2024-01-15", "amount": 1000, "currency": "USD", "fxToBase": 1, "type": "Deposits/Withdrawals", "description": "Deposit"}, {"date": "2024-06-01", "amount": 120, "currency": "USD", "fxToBase": 1, "type": "Dividend", "description": "ACME Dividend"}, {"date": "2024-06-01", "amount": -30, "currency": "USD", "fxToBase": 1, "type": "Withholding Tax", "description": "ACME Withholding"}], "navPeriods": [{"fromDate": "2024-01-01", "toDate": "2024-12-31", "startingValue": 10000, "endingValue": 12500, "netFlows": 1000, "twr": 12.5, "source": "ibkr"}], "cashBalances": [{"currency": "USD", "balance": 5000}]};
const FX_B = {"meta": {"fromDate": "2025-01-01", "toDate": "2025-12-31", "baseCurrency": "USD"}, "trades": [{"symbol": "ACME", "date": "2025-02-01", "qty": 10, "side": "BUY", "price": 100, "proceeds": 1000, "commission": 1, "realized": 0, "currency": "USD", "asset": "Stocks", "tradeId": "", "fxToBase": 1}, {"symbol": "ACME", "date": "2025-05-01", "qty": 4, "side": "SELL", "price": 120, "proceeds": -480, "commission": 1, "realized": 80, "currency": "USD", "asset": "Stocks", "tradeId": "", "fxToBase": 1}], "positions": [{"symbol": "ACME", "qty": 6, "asset": "Stocks", "currency": "USD", "markPrice": 121, "marketValue": 726, "costBasis": 600, "unrealized": 126, "levelOfDetail": "SUMMARY", "fxToBase": 1}], "cashTransactions": [{"date": "2025-01-15", "amount": 1000, "currency": "USD", "fxToBase": 1, "type": "Deposits/Withdrawals", "description": "Deposit"}, {"date": "2025-06-01", "amount": 120, "currency": "USD", "fxToBase": 1, "type": "Dividend", "description": "ACME Dividend"}, {"date": "2025-06-01", "amount": -30, "currency": "USD", "fxToBase": 1, "type": "Withholding Tax", "description": "ACME Withholding"}], "navPeriods": [{"fromDate": "2025-01-01", "toDate": "2025-12-31", "startingValue": 10000, "endingValue": 12500, "netFlows": 1000, "twr": 12.5, "source": "ibkr"}], "cashBalances": [{"currency": "USD", "balance": 5000}]};
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ---------- מיזוג: דוח חדש עם תיק ריק גובר; דוח ישן לא דורס ---------- */
{
  const oldD = { meta: { fromDate: '2023-01-01', toDate: '2024-09-27' }, navPeriods: [], trades: [], cashTransactions: [], positions: [{ symbol: 'OLD', qty: 5 }], cashBalances: [{ currency: 'USD', balance: 100 }] };
  const newEmpty = { meta: { fromDate: '2024-09-27', toDate: '2026-09-24' }, navPeriods: [], trades: [], cashTransactions: [], positions: [], cashBalances: [] };
  const m1 = R.rMergeData(oldD, newEmpty);
  eq(m1.positions.length, 0, 'merge: newer empty portfolio wins over stale');
  eq(m1.cashBalances.length, 0, 'merge: newer empty cash wins over stale');
  const m2 = R.rMergeData(newEmpty, oldD);
  eq(m2.positions.length, 0, 'merge: older report does not clobber newer positions');
  const newFull = { ...newEmpty, positions: [{ symbol: 'NEW', qty: 9 }], cashBalances: [{ currency: 'USD', balance: 200 }] };
  const m3 = R.rMergeData(oldD, newFull);
  eq(m3.positions[0].symbol, 'NEW', 'merge: newer positions replace older');
}

/* ---------- מיזוג ---------- */
{
  const a = clone(FX_A);
  const b = clone(FX_B);
  const m0 = R.rMergeData(a, a);
  eq([m0.trades.length, m0.navPeriods.length], [2, 1], 'merge: self-merge dedupes');
  const m = R.rMergeData(a, b);
  eq(m.navPeriods.length, 2, 'merge: two periods accumulate');
  eq(m.navPeriods[0].fromDate < m.navPeriods[1].fromDate, true, 'merge: periods sorted');
  eq(m.meta.fromDate, '2024-01-01', 'merge: meta fromDate = min');
  eq(m.meta.toDate, '2025-12-31', 'merge: meta toDate = max');
  // שרשור: 12.5% ואז 12.5% = 26.5625%
  approx(R.rChainTwr(m.navPeriods), 26.5625, 1e-9, 'merge: chain-link across periods');
}

/* ---------- שרשור TWR ---------- */
approx(R.rChainTwr([{ twr: 10 }, { twr: -5 }]), 4.5, 1e-9, 'chain: 10%,-5% = 4.5%');
approx(R.rChainTwr([{ twr: 18.795871983 }]), 18.795871983, 1e-9, 'chain: single');
eq(R.rChainTwr([]), null, 'chain: empty -> null');
eq(R.rChainTwr([{ twr: null }]), null, 'chain: no finite -> null');
eq(R.rChainTwr([{ twr: -100 }]), null, 'chain: -100% invalid -> null');

/* ---------- סדרת מדד ---------- */
{
  const s = R.rTwrIndexSeries([{ fromDate: '2024-01-01', toDate: '2024-06-30', twr: 10 },
    { fromDate: '2024-07-01', toDate: '2024-12-31', twr: 10 }]);
  eq(s.map((p) => p.date), ['2024-01-01', '2024-06-30', '2024-12-31'], 'index series dates');
  approx(s[0].value, 100, 1e-9, 'index series start');
  approx(s[1].value, 110, 1e-9, 'index series mid');
  approx(s[2].value, 121, 1e-9, 'index series end');
}

/* ---------- סכומים ---------- */
{
  const d = clone(FX_A);
  const s = R.rSums(d);
  approx(s.realized, 80, 1e-9, 'sums: realized');
  approx(s.unrealized, 126, 1e-9, 'sums: unrealized');
  approx(s.dividends, 120, 1e-9, 'sums: dividends');
  approx(s.withholding, -30, 1e-9, 'sums: withholding negative');
  approx(s.commissions, 2, 1e-9, 'sums: commissions abs');
}

/* ---------- XIRR ---------- */
const _x = R.rXirr([{ d: '2024-01-01', amt: -1000 }, { d: '2025-01-01', amt: 1100 }]);
ok(_x > 9.9 && _x < 10.1, 'xirr: textbook case ~10% (actual/365.25 day count)');
eq(R.rXirr([{ d: '2024-01-01', amt: -1000 }]), null, 'xirr: single flow -> null');
{
  const d = clone(FX_A);
  const xf = R.rXirrFlows(d);
  ok(xf && xf.length === 3, 'xirrFlows: start + 1 deposit + end');
  eq(xf[0].amt < 0 && xf[2].amt > 0, true, 'xirrFlows: signs (out negative, in positive)');
  const x = R.rXirr(xf);
  ok(isFinite(x), 'xirr: converges on synthetic data');
}

/* ---------- תקופות ממקור טוקן (תאימות לאחור) ---------- */
{
  const tokenData = {
    meta: { fromDate: '2024-01-01', toDate: '2024-12-31' },
    navHistory: [
      { fromDate: '2024-01-01', toDate: '2024-06-30', startingValue: 10000, endingValue: 10500, twr: 5 },
      { fromDate: '2024-07-01', toDate: '2024-12-31', startingValue: 10500, endingValue: 11000, twr: 4 },
    ],
  };
  const ps = R.rNavPeriods(tokenData);
  eq(ps.length, 2, 'token navHistory -> periods');
  approx(R.rChainTwr(ps), 9.2, 1e-9, 'token periods chain');
}

/* ---------- מיזוג תקופות חופפות: עדכון, לא כפילות ---------- */
{
  const p = (a, b, twr) => ({ fromDate: a, toDate: b, twr: twr, startingValue: 100, endingValue: 110, netFlows: 0 });
  // חופפות חלקית — החדשה מחליפה
  const r1 = R.rMergePeriods([p('2024-01-01', '2024-12-31', 10)], [p('2024-06-01', '2025-06-01', 5)]);
  eq(r1.periods.length, 1, 'overlap: new replaces overlapping');
  eq(r1.periods[0].toDate, '2025-06-01', 'overlap: new period kept');
  eq(r1.replaced.length, 1, 'overlap: replaced reported');
  // טווח רחב יותר מכסה את הישן — החלפה מלאה, בלי כפילות
  const r2 = R.rMergePeriods([p('2024-01-01', '2024-12-31', 10)], [p('2024-01-01', '2025-12-31', 15)]);
  eq([r2.periods.length, r2.replaced.length], [1, 1], 'wider: single period, old replaced');
  approx(R.rChainTwr(r2.periods), 15, 1e-9, 'wider: no double count');
  // עוקבות — שתיהן נשמרות ומשורשרות
  const r3 = R.rMergePeriods([p('2024-01-01', '2024-12-31', 10)], [p('2025-01-01', '2025-12-31', 10)]);
  eq(r3.periods.length, 2, 'adjacent: both kept');
  eq(r3.replaced.length, 0, 'adjacent: nothing replaced');
  approx(R.rChainTwr(r3.periods), 21, 1e-9, 'adjacent: chained 10%+10%=21%');
  // אותה תקופה בדיוק — כפילות, לא "החלפה": נשארת אחת, לא מדווחת כמוחלפת
  const r4 = R.rMergePeriods([p('2024-01-01', '2024-12-31', 10)], [p('2024-01-01', '2024-12-31', 10)]);
  eq(r4.periods.length, 1, 'identical: still one period');
  eq(r4.replaced.length, 0, 'identical: not reported as replaced');
  // אותה תקופה עם TWR שונה — כן מוחלפת (החדש גובר)
  const r5 = R.rMergePeriods([p('2024-01-01', '2024-12-31', 10)], [p('2024-01-01', '2024-12-31', 12)]);
  eq([r5.periods.length, r5.replaced.length], [1, 1], 'same range diff twr: replaced');
  eq(r5.periods[0].twr, 12, 'same range diff twr: new value kept');
  ok(R.rPeriodsEqual(p('2024-01-01', '2024-12-31', 10), p('2024-01-01', '2024-12-31', 10)), 'rPeriodsEqual: identical');
  ok(!R.rPeriodsEqual(p('2024-01-01', '2024-12-31', 10), p('2024-01-01', '2024-12-31', 12)), 'rPeriodsEqual: twr differs');
  ok(!R.rPeriodsOverlap({ fromDate: '2024-01-01', toDate: '2024-06-30' }, { fromDate: '2024-06-30', toDate: '2024-12-31' }), 'overlap: touching edges are adjacent, not overlapping');
  ok(!R.rPeriodsOverlap({ fromDate: '2024-01-01', toDate: '2024-06-29' }, { fromDate: '2024-06-30', toDate: '2024-12-31' }), 'overlap: disjoint');
  // תקופות עוקבות שנוגעות בגבול — נשמרות ומשורשרות, לא מוחלפות
  const r6 = R.rMergePeriods([p('2024-01-01', '2024-06-30', 5)], [p('2024-06-30', '2024-12-31', 8)]);
  eq(r6.periods.length, 2, 'adjacent-touching: both kept');
  eq(r6.replaced.length, 0, 'adjacent-touching: nothing replaced');
  approx(R.rChainTwr(r6.periods), 13.4, 1e-9, 'adjacent-touching: chained 5%+8%=13.4%');
}

/* ---------- תצוגה מקדימה של מיזוג ---------- */
{
  const mk = (per, tr, cx) => ({
    meta: { fromDate: '2024-01-01', toDate: '2024-12-31' },
    navPeriods: per, trades: tr, cashTransactions: cx, positions: [], cashBalances: [],
  });
  const t1 = { date: '2024-02-01', symbol: 'ACME', side: 'BUY', qty: 10, price: 100, commission: 1, currency: 'USD' };
  const t2 = { date: '2024-08-01', symbol: 'ACME', side: 'BUY', qty: 5, price: 110, commission: 1, currency: 'USD' };
  const c1 = { date: '2024-01-15', type: 'Deposits/Withdrawals', amount: 1000, currency: 'USD', description: 'Deposit' };
  const oldD = mk(
    [{ fromDate: '2024-01-01', toDate: '2024-12-31', twr: 10, startingValue: 100, endingValue: 110, netFlows: 0 }],
    [t1], [c1]);
  const newD = mk(
    [{ fromDate: '2024-01-01', toDate: '2024-12-31', twr: 10, startingValue: 100, endingValue: 110, netFlows: 0 }],
    [t1, t2], [c1]);
  const pr = R.rMergePreview(oldD, newD);
  eq([pr.newTrades, pr.dupTrades], [1, 1], 'preview: 1 new trade, 1 duplicate skipped');
  eq([pr.newCash, pr.dupCash], [0, 1], 'preview: cash all duplicate');
  eq(pr.addedPeriods.length, 0, 'preview: no new periods');
  // קובץ זהה לחלוטין — שום דבר חדש
  const pr2 = R.rMergePreview(oldD, oldD);
  eq([pr2.newTrades, pr2.newCash, pr2.addedPeriods.length], [0, 0, 0], 'preview: identical file -> nothing new');
  // rMergeData עם חפיפה — לא מכפיל תקופות
  const m = R.rMergeData(oldD, newD);
  eq(m.navPeriods.length, 1, 'mergeData: overlapping period not duplicated');
  eq(m.trades.length, 2, 'mergeData: trades merged without dup');
}

/* ---------- איחוד מודע־מופעים ---------- */
{
  const c = (date, amount) => ({ date: date, type: 'Deposits/Withdrawals', amount: amount, currency: 'USD', description: 'Deposit' });
  const mkD = (txs) => ({ meta: {}, navPeriods: [], trades: [], cashTransactions: txs, positions: [], cashBalances: [] });
  // שתי הפקדות זהות לגיטימיות באותו יום — נשמרות שתיהן
  const m1 = R.rMergeData(mkD([c('2024-01-15', 1000), c('2024-01-15', 1000)]), mkD([]));
  eq(m1.cashTransactions.length, 2, 'union: two identical legit deposits kept');
  // יבוא חוזר של אותו דוח — לא מכפיל
  const m2 = R.rMergeData(mkD([c('2024-01-15', 1000)]), mkD([c('2024-01-15', 1000)]));
  eq(m2.cashTransactions.length, 1, 'union: re-import does not duplicate');
  // ישן 1, חדש 2 (אחת ישנה + אחת חדשה זהה) — סה"כ 2
  const m3 = R.rMergeData(mkD([c('2024-01-15', 1000)]), mkD([c('2024-01-15', 1000), c('2024-01-15', 1000)]));
  eq(m3.cashTransactions.length, 2, 'union: max occurrences kept');
  // תצוגה מקדימה מודעת־מופעים
  const pr = R.rMergePreview(mkD([c('2024-01-15', 1000)]), mkD([c('2024-01-15', 1000), c('2024-01-15', 1000)]));
  eq([pr.newCash, pr.dupCash], [1, 1], 'preview: occurrence-aware counts');
  // tradeId קודם לשדות
  const tA = { date: '2024-02-01', symbol: 'ACME', side: 'BUY', qty: 10, price: 100, tradeId: 'X1' };
  const tB = { date: '2024-02-01', symbol: 'ACME', side: 'BUY', qty: 10, price: 100, tradeId: 'X2' };
  const tC = { date: '2024-02-01', symbol: 'ACME', side: 'BUY', qty: 10, price: 100, tradeId: 'X1' };
  const mt = R.rMergeData({ meta: {}, navPeriods: [], trades: [tA], cashTransactions: [], positions: [], cashBalances: [] },
                          { meta: {}, navPeriods: [], trades: [tB, tC], cashTransactions: [], positions: [], cashBalances: [] });
  eq(mt.trades.length, 2, 'tradeKey: different tradeIds kept, same tradeId deduped');
}

console.log('\nPASS: ' + n + ' assertions');
