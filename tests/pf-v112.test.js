// pf-v112.test.js — פארסר CSV + מנוע תשואות חדש (נבנה מאפס).
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

/* ---------- טוקניזר ---------- */
{
  const rows = R.csvRows('a,"b,c","d""e"\r\nx,y,z\r\n');
  eq(rows, [['a', 'b,c', 'd"e'], ['x', 'y', 'z']], 'csvRows: quotes+escaped+CRLF');
  const bom = R.csvRows('\uFEFFStatement,Header,A\r\n');
  eq(bom[0][0], 'Statement', 'csvRows: BOM stripped');
}

/* ---------- תקופת דוח ---------- */
eq(R.parseStatementPeriod('September 29, 2023 - September 27, 2024'),
  ['2023-09-29', '2024-09-27'], 'parseStatementPeriod');
eq(R.parseStatementPeriod('January 1, 2025 - March 31, 2025'),
  ['2025-01-01', '2025-03-31'], 'parseStatementPeriod Q1');

/* ---------- Activity Statement סינתטי ---------- */
const ACTIVITY_CSV = [
  'Statement,Header,Field Name,Field Value',
  'Statement,Data,Title,Activity Statement',
  'Statement,Data,Period,"January 1, 2024 - December 31, 2024"',
  'Account Information,Header,Field Name,Field Value',
  'Account Information,Data,Base Currency,USD',
  'Net Asset Value,Header,Asset Class,Prior Total,Current Total,Change',
  'Net Asset Value,Data,Total,10000,12500,2500',
  'Net Asset Value,Data,12.5%',
  'Change in NAV,Header,Field Name,Field Value',
  'Change in NAV,Data,Starting Value,10000',
  'Change in NAV,Data,Mark-to-Market,1500',
  'Change in NAV,Data,Deposits & Withdrawals,1000',
  'Change in NAV,Data,Dividends,120',
  'Change in NAV,Data,Withholding Tax,-30',
  'Change in NAV,Data,Change in Dividend Accruals,0',
  'Change in NAV,Data,Commissions,-90',
  'Change in NAV,Data,Ending Value,12500',
  'Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis,Realized P/L,MTM P/L,Code',
  'Trades,Data,Order,Stocks,USD,ACME,"2024-02-01, 10:00:00",10,100,101,1000,-1,0,0,0,',
  'Trades,Data,Order,Stocks,USD,ACME,"2024-05-01, 10:00:00",-4,120,121,-480,-1,0,80,0,',
  'Trades,SubTotal,Stocks,USD,ACME,,,,,520,-2,,,,',
  'Trades,Total,,,,,,,,,518,-2,,,,',
  'Open Positions,Header,DataDiscriminator,Asset Category,Currency,Symbol,Quantity,Mult,Cost Price,Cost Basis,Close Price,Value,Unrealized P/L,Code',
  'Open Positions,Data,Summary,Stocks,USD,ACME,6,1,100,600,121,726,126,',
  'Open Positions,Total,,,,,,,,,,,726,126,',
  'Deposits & Withdrawals,Header,Currency,Settle Date,Description,Amount',
  'Deposits & Withdrawals,Data,USD,2024-01-15,Deposit,1000',
  'Dividends,Header,Currency,Date,Description,Amount',
  'Dividends,Data,USD,2024-06-01,ACME Dividend,120',
  'Withholding Tax,Header,Currency,Date,Description,Amount,Code',
  'Withholding Tax,Data,USD,2024-06-01,ACME Withholding,-30,',
  'Cash Report,Header,Currency Summary,Currency,Total,Securities,Futures,',
  'Cash Report,Data,Ending Cash,Base Currency Summary,5000,5000,0,',
].join('\r\n');

{
  const res = R.ibkrParseCsv(ACTIVITY_CSV);
  ok(res.ok, 'activity: ok');
  eq(res.stats.kind, 'activity', 'activity: kind');
  eq(res.warnings, [], 'activity: no warnings');
  eq([res.stats.trades, res.stats.positions, res.stats.cashTxs], [2, 1, 3], 'activity: counts');
  eq([res.stats.fromDate, res.stats.toDate], ['2024-01-01', '2024-12-31'], 'activity: period');

  const t0 = res.data.trades[0], t1 = res.data.trades[1];
  eq([t0.symbol, t0.side, t0.qty, t0.date], ['ACME', 'BUY', 10, '2024-02-01'], 'activity: buy from +qty');
  eq([t1.side, t1.qty, t1.realized], ['SELL', 4, 80], 'activity: sell from -qty');
  eq(res.data.trades.length, 2, 'activity: SubTotal/Total ignored');

  const p = res.data.positions[0];
  eq([p.symbol, p.qty, p.markPrice, p.marketValue, p.costBasis], ['ACME', 6, 121, 726, 600], 'activity: position');

  const np = res.data.navPeriods[0];
  approx(np.twr, 12.5, 1e-9, 'activity: official TWR from % row');
  eq([np.startingValue, np.endingValue, np.netFlows], [10000, 12500, 1000], 'activity: NAV values');

  const types = res.data.cashTransactions.map((c) => c.type).sort();
  eq(types, ['Deposits/Withdrawals', 'Dividend', 'Withholding Tax'], 'activity: cash types');
  eq(res.data.cashBalances, [{ currency: 'USD', balance: 5000 }], 'activity: cash balance');

  // זהות חשבונאית: 10000+1500+1000+120-30+0-90 = 12500
  approx(R.rGain(res.data), 1500, 1e-6, 'activity: gain = end-start-flows');
  approx(R.rHeadlineTwr(res.data), 12.5, 1e-9, 'activity: headline TWR');
  eq(R.rSourceKind(res.data), 'official', 'activity: source official');
}

/* ---------- אזהרות ---------- */
{
  const noTwr = ACTIVITY_CSV.split('\r\n').filter((l) => !/^Net Asset Value,Data,12/.test(l)).join('\r\n');
  const res = R.ibkrParseCsv(noTwr);
  ok(res.warnings.includes('no-twr'), 'warn: no-twr when % row missing');
  eq(R.rHeadlineTwr(res.data), null, 'no official TWR -> headline null (no guessing)');
  eq(R.rSourceKind(res.data), 'nav', 'source falls to nav when values exist');
}

/* ---------- Flex Query סינתטי ---------- */
const FLEX_CSV = [
  'Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,Proceeds,Buy/Sell,Comm/Fee,TradeID',
  'Trades,Data,Order,Stocks,USD,GLOBEX,2024-03-01 11:00:00,5,200,1000,BUY,-2,T1',
  'Open Positions,Header,DataDiscriminator,Asset Category,Currency,Symbol,Position,Mark Price,Position Value,Cost Basis Money,Fifo Pnl Unrealized,Level Of Detail',
  'Open Positions,Data,Summary,Stocks,USD,GLOBEX,5,210,1050,1000,50,SUMMARY',
  'Open Positions,Data,Lot,Stocks,USD,GLOBEX,5,210,1050,1000,50,LOT',
  'Change in NAV,Header,From Date,To Date,Starting Value,Ending Value,TWR',
  'Change in NAV,Data,2024-01-01,2024-12-31,10000,11200,12',
].join('\n');
{
  const res = R.ibkrParseCsv(FLEX_CSV);
  eq(res.stats.kind, 'flex', 'flex: kind');
  eq(res.data.trades[0].side, 'BUY', 'flex: explicit Buy/Sell wins');
  eq(res.data.positions.length, 1, 'flex: LOT filtered, SUMMARY kept');
  approx(res.data.navPeriods[0].twr, 12, 1e-9, 'flex: TWR column');
  approx(R.rHeadlineTwr(res.data), 12, 1e-9, 'flex: headline');
}

/* ---------- מיזוג ---------- */
{
  const a = R.ibkrParseCsv(ACTIVITY_CSV).data;
  const b = R.ibkrParseCsv(ACTIVITY_CSV.replace(/2024/g, '2025')
    .replace('January 1, 2025 - December 31, 2025', 'January 1, 2025 - December 31, 2025')).data;
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
  const d = R.ibkrParseCsv(ACTIVITY_CSV).data;
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
  const d = R.ibkrParseCsv(ACTIVITY_CSV).data;
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
  ok(R.rPeriodsOverlap({ fromDate: '2024-01-01', toDate: '2024-06-30' }, { fromDate: '2024-06-30', toDate: '2024-12-31' }), 'overlap: touching edges count');
  ok(!R.rPeriodsOverlap({ fromDate: '2024-01-01', toDate: '2024-06-29' }, { fromDate: '2024-06-30', toDate: '2024-12-31' }), 'overlap: disjoint');
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
