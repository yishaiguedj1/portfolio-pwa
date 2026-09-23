/* בדיקות ל־v48: היסטוריה אמיתית מעסקאות IBKR + טוען היסטוריה מהיר.
   הרצה: node tests/pf-v48.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log('ok -', name); };

const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const document = {
  addEventListener() {},
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({}),
};
let fetchCalls = [];
const yahooBars = (closes, startISO) => {
  const ts = closes.map((_, i) => Date.parse(startISO + 'T13:30:00Z') / 1000 + i * 86400);
  return {
    chart: {
      result: [{
        timestamp: ts,
        meta: { gmtoffset: 0 },
        indicators: { quote: [{ open: closes, high: closes, low: closes, close: closes, volume: closes.map(() => 1) }] },
      }],
      error: null,
    },
  };
};
const sandbox = {
  localStorage, document,
  window: {}, navigator: {}, location: {},
  AbortController,
  fetch: async (url) => {
    fetchCalls.push(String(url));
    if (String(url).includes('finance.yahoo.com')) {
      // 30 ימי מסחר: 100 -> 110
      const closes = Array.from({ length: 30 }, (_, i) => 100 + i * (10 / 29));
      return { ok: true, text: async () => JSON.stringify(yahooBars(closes, '2026-08-20')) };
    }
    throw new Error('unexpected fetch: ' + url);
  },
  setTimeout, clearTimeout, console,
};
vm.createContext(sandbox);
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8') +
  '\n;globalThis.__t = { buildTradesHistory, getDailyFast, ibkrIsDepositTx, pfBenchOn, pfShowBench, _state: () => state, _resetHist() { state.hist = {}; for (const k of Object.keys(histInflight)) delete histInflight[k]; }, _setBench(b) { state.pfBench = b; }, warmPfHistories, isChartableSym, ibkrIsStockTrade, ibkrIsDividendTx, ibkrSaveCfg, _setDB(d) { Object.keys(DB).forEach((k) => delete DB[k]); Object.assign(DB, d); }, _setPos(p) { POSITIONS.length = 0; POSITIONS.push(...p); } };';
vm.runInContext(src, sandbox, { filename: 'app.js' });
const T = sandbox.__t;
ok(!!T, 'app.js נטען בלי שגיאות תחביר');

/* ---------- buildTradesHistory ---------- */
const D = (iso, close) => ({ date: iso, close });
function hist30(sym, c0, c1, startISO) {
  const rows = [];
  const d0 = new Date(startISO + 'T12:00:00Z');
  for (let i = 0; i < 30; i++) {
    const d = new Date(d0.getTime() + i * 86400000);
    rows.push(D(d.toISOString().slice(0, 10), c0 + (c1 - c0) * (i / 29)));
  }
  return rows;
}
const fxOf = () => 3.2;

{
  ok(T.buildTradesHistory({ trades: [] }).length === 0, 'אין עסקאות -> מערך ריק');
  ok(T.buildTradesHistory({}).length === 0, 'אין כלום -> מערך ריק');
}

{ // קנייה אחת, מחיר עולה 100->110, בלי תזרים, מזומן 0 — TWR צריך להיות +10% בדיוק
  const h = hist30('AAA', 100, 110, '2026-08-20');
  const rows = T.buildTradesHistory({
    trades: [{ date: '2026-08-20', symbol: 'AAA', side: 'BUY', qty: 10, price: 100, commission: 1, currency: 'USD', fxToBase: 1 }],
    cashTx: [],
    positions: [{ sym: 'AAA', shares: 10 }],
    cash: { usd: 0, ils: 0 }, // 1000 התחלתי - 1000 קנייה - 1 עמלה... העמלה זניחה פה
    hist: { AAA: h },
    fxOf,
  });
  ok(rows.length >= 2, 'יש סדרה');
  const ret = rows[rows.length - 1].value / 100 - 1;
  ok(Math.abs(ret - 0.10) < 0.02, 'TWR +10% בלי תזרים, בפועל ' + (ret * 100).toFixed(2) + '%');
}

{ // הפקדה באמצע התקופה לא נראית כרווח: מחיר קבוע + הפקדה 9000 -> TWR ~0 (נאיבי היה +400%)
  const h = hist30('AAA', 100, 100, '2026-08-20');
  const rows = T.buildTradesHistory({
    trades: [{ date: '2026-08-20', symbol: 'AAA', side: 'BUY', qty: 10, price: 100, commission: 0, currency: 'USD', fxToBase: 1 }],
    cashTx: [{ date: '2026-09-03', amount: 9000, currency: 'USD', fxToBase: 1, type: 'Deposit', description: 'Deposit' }],
    positions: [{ sym: 'AAA', shares: 10 }],
    cash: { usd: 9000, ils: 0 }, // 1000 - 1000 + 9000
    hist: { AAA: h },
    fxOf,
  });
  const ret = rows[rows.length - 1].value / 100 - 1;
  ok(Math.abs(ret) < 0.01, 'הפקדה לא מנפחת — TWR ~0%, בפועל ' + (ret * 100).toFixed(2) + '%');
}

{ // משיכה באמצע התקופה לא נראית כהפסד: מחיר קבוע + משיכה 9000 -> TWR ~0 (נאיבי היה ‎-45%‎)
  const h = hist30('AAA', 100, 100, '2026-08-20');
  const rows = T.buildTradesHistory({
    trades: [{ date: '2026-08-21', symbol: 'AAA', side: 'BUY', qty: 100, price: 100, commission: 0, currency: 'USD', fxToBase: 1 }],
    cashTx: [
      { date: '2026-08-20', amount: 20000, currency: 'USD', fxToBase: 1, type: 'Deposit', description: 'Deposit' },
      { date: '2026-09-03', amount: -9000, currency: 'USD', fxToBase: 1, type: 'Withdrawal', description: 'Withdrawal' },
    ],
    positions: [{ sym: 'AAA', shares: 100 }],
    cash: { usd: 1000, ils: 0 }, // 20000 - 10000 - 9000
    hist: { AAA: h },
    fxOf,
  });
  const ret = rows[rows.length - 1].value / 100 - 1;
  ok(Math.abs(ret) < 0.01, 'משיכה לא מפילה — TWR ~0%, בפועל ' + (ret * 100).toFixed(2) + '%');
}

{ // הפקדה + עליית מחיר: התשואה אמיתית, לא מנופחת (נאיבי היה +205%)
  const h = hist30('AAA', 100, 110, '2026-08-20');
  const rows = T.buildTradesHistory({
    trades: [{ date: '2026-08-20', symbol: 'AAA', side: 'BUY', qty: 10, price: 100, commission: 0, currency: 'USD', fxToBase: 1 }],
    cashTx: [{ date: '2026-08-27', amount: 5000, currency: 'USD', fxToBase: 1, type: 'Deposit', description: 'Deposit' }],
    positions: [{ sym: 'AAA', shares: 10 }],
    cash: { usd: 5000, ils: 0 }, // 1000 - 1000 + 5000
    hist: { AAA: h },
    fxOf,
  });
  const ret = rows[rows.length - 1].value / 100 - 1;
  ok(ret > 0.02 && ret < 0.08, 'הפקדה + עלייה — TWR סביר (~4.6%), לא מנופח, בפועל ' + (ret * 100).toFixed(2) + '%');
}

{ // מכירה באמצע — הכמות משוחזרת לאחור נכון (לפני המכירה היו יותר מניות)
  const h = hist30('AAA', 100, 100, '2026-08-20'); // מחיר קבוע — התשואה צריכה להיות ~0
  const rows = T.buildTradesHistory({
    trades: [
      { date: '2026-08-20', symbol: 'AAA', side: 'BUY', qty: 10, price: 100, commission: 0, currency: 'USD', fxToBase: 1 },
      { date: '2026-09-01', symbol: 'AAA', side: 'SELL', qty: 4, price: 100, commission: 0, currency: 'USD', fxToBase: 1 },
    ],
    cashTx: [],
    positions: [{ sym: 'AAA', shares: 6 }],
    cash: { usd: 400, ils: 0 }, // 400 = תמורת המכירה
    hist: { AAA: h },
    fxOf,
  });
  ok(rows.length >= 2, 'סדרה עם מכירה');
  const ret = rows[rows.length - 1].value / 100 - 1;
  ok(Math.abs(ret) < 0.02, 'מחיר קבוע + מכירה -> תשואה ~0%, בפועל ' + (ret * 100).toFixed(2) + '%');
}

{ // עסקה בלי תאריך תקין מתעלמת
  const h = hist30('AAA', 100, 110, '2026-08-20');
  const rows = T.buildTradesHistory({
    trades: [
      { date: '', symbol: 'AAA', side: 'BUY', qty: 10, price: 100, commission: 0, currency: 'USD', fxToBase: 1 },
      { date: '2026-08-20', symbol: 'AAA', side: 'BUY', qty: 10, price: 100, commission: 0, currency: 'USD', fxToBase: 1 },
    ],
    cashTx: [],
    positions: [{ sym: 'AAA', shares: 10 }],
    cash: { usd: 0, ils: 0 },
    hist: { AAA: h },
    fxOf,
  });
  ok(rows.length >= 2, 'עסקה פגומה לא שוברת');
}

/* ---------- טוגל מדדי השוואה ---------- */
{
  T._setBench(null);
  ok(T.pfBenchOn('SPY') === true, 'SPY דולק כברירת מחדל');
  ok(T.pfBenchOn('QQQ') === true, 'QQQ דולק כברירת מחדל');
  T._setBench({ SPY: false });
  ok(T.pfBenchOn('SPY') === false, 'SPY כבוי אחרי טוגל');
  ok(T.pfBenchOn('QQQ') === true, 'QQQ נשאר דולק');
  T._setBench({ SPY: true, QQQ: true });
  ok(T.pfBenchOn('SPY') && T.pfBenchOn('QQQ'), 'שניהם דולקים שוב');
  T._setBench(null);
}

/* ---------- הפרדת ממשקים: השוואה רק ל־IBKR ---------- */
{
  ok(T.pfShowBench('ibkr') === true, 'NAV מ־IBKR — יש השוואה');
  ok(T.pfShowBench('trades') === true, 'שחזור מעסקאות IBKR — יש השוואה');
  ok(T.pfShowBench('manual') === false, 'הזנה ידנית — אין השוואה');
  ok(T.pfShowBench('') === false, 'מקור לא ידוע — אין השוואה');
}

/* ---------- getDailyFast ---------- */
(async () => {
  T._resetHist();
  fetchCalls = [];
  const rows = await T.getDailyFast('AAA', false);
  ok(rows.length === 30, 'Yahoo תחילה — 30 שורות');
  ok(fetchCalls.some((u) => u.includes('finance.yahoo.com')), 'נקרא Yahoo');
  ok(!fetchCalls.some((u) => u.includes('twelvedata')), 'לא נקרא Twelve Data כש־Yahoo הצליח');
  ok(T._state().hist.AAA && T._state().hist.AAA.length === 30, 'נשמר ב־state.hist');
  const calls1 = fetchCalls.length;
  const rows2 = await T.getDailyFast('AAA', false);
  ok(rows2.length === 30 && fetchCalls.length === calls1, 'קריאה שנייה מהזיכרון — בלי רשת');

  // רגרסיה: Yahoo תלוי (לא עונה) — Stooq מנצח במרוץ בלי לחכות ל־timeout
  T._resetHist();
  for (const k of Object.keys(store)) delete store[k];
  const stooqCSV = 'Date,Open,High,Low,Close,Volume\n' +
    Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.parse('2026-08-20T12:00:00Z') + i * 86400000).toISOString().slice(0, 10);
      const c = (100 + i).toFixed(2);
      return d + ',' + c + ',' + c + ',' + c + ',' + c + ',1000';
    }).join('\n');
  sandbox.fetch = async (url) => {
    const u = String(url);
    if (u.includes('finance.yahoo.com')) return new Promise(() => {}); // תלוי לנצח
    if (u.includes('stooq.com')) return { ok: true, text: async () => stooqCSV };
    throw new Error('unexpected fetch: ' + u);
  };
  const t0 = Date.now();
  const rows3 = await T.getDailyFast('BBB', false);
  const dt = Date.now() - t0;
  ok(rows3.length === 30, 'Stooq ניצח במרוץ — 30 שורות');
  ok(dt < 5000, 'בלי לחכות ל־timeout של Yahoo (' + dt + 'ms)');

  /* ---------- v53: סינון סמלי מט"ח, dedup, התקדמות ---------- */
  ok(T.isChartableSym('AAPL'), 'AAPL תקין לגרף');
  ok(T.isChartableSym('BRK.B'), 'BRK.B תקין לגרף');
  ok(!T.isChartableSym('USD.ILS'), 'USD.ILS (מט"ח) לא נטען לגרף');
  ok(!T.isChartableSym('EUR.USD'), 'EUR.USD (מט"ח) לא נטען לגרף');
  ok(!T.isChartableSym('AAPL  260919C00150000'), 'אופציה לא נטענת לגרף');

  // warmPfHistories במצב IBKR: מדלג על USD.ILS, מדווח התקדמות
  T._resetHist();
  for (const k of Object.keys(store)) delete store[k];
  T._setDB({ source: 'ibkr', cash: { usd: 0, ils: 0 }, positions: [], deposits: [] });
  T._setPos([{ sym: 'AAA', shares: 10 }]);
  T.ibkrSaveCfg({ proxyUrl: 'x', token: 'y', queryId: 'z', data: { trades: [
    { symbol: 'AAA', date: '2026-01-05', side: 'BUY', qty: 10, price: 100, commission: 1, fxToBase: 1 },
    { symbol: 'USD.ILS', date: '2026-02-05', side: 'BUY', qty: 1000, price: 3.5, commission: 0, fxToBase: 1 },
  ], cashTransactions: [], navHistory: [] } });
  const yahoo30 = (() => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const ts = closes.map((_, i) => Date.parse('2026-08-20T13:30:00Z') / 1000 + i * 86400);
    return JSON.stringify({ chart: { result: [{ timestamp: ts, meta: { gmtoffset: 0 }, indicators: { quote: [{ open: closes, high: closes, low: closes, close: closes, volume: closes.map(() => 1) }] } }], error: null } });
  })();
  const fetchedSyms = [];
  sandbox.fetch = async (url) => {
    const u = String(url);
    const m = u.match(/\/chart\/([^?]+)/) || u.match(/s=([a-z0-9.]+)/i);
    if (m) fetchedSyms.push(decodeURIComponent(m[1]).toUpperCase());
    if (u.includes('finance.yahoo.com')) return { ok: true, text: async () => yahoo30 };
    throw new Error('unexpected fetch: ' + u);
  };
  const prog = [];
  await T.warmPfHistories((done, total) => prog.push([done, total]));
  ok(!fetchedSyms.some((s) => s.includes('USD')), 'לא נטען היסטוריה ל־USD.ILS');
  ok(fetchedSyms.some((s) => s === 'AAA'), 'נטען היסטוריה ל־AAA');
  ok(prog.length === 1 && prog[0][0] === 1 && prog[0][1] === 1, 'התקדמות דווחה (1/1): ' + JSON.stringify(prog));

  // dedup: שתי קריאות מקביליות לאותו סימבול = בקשת רשת אחת
  T._resetHist();
  for (const k of Object.keys(store)) delete store[k];
  let netCount = 0;
  sandbox.fetch = async (url) => {
    netCount++;
    await new Promise((r) => setTimeout(r, 50));
    if (String(url).includes('finance.yahoo.com')) return { ok: true, text: async () => yahoo30 };
    throw new Error('unexpected fetch: ' + url);
  };
  const [r1, r2] = await Promise.all([T.getDailyFast('CCC', false), T.getDailyFast('CCC', false)]);
  ok(r1.length === 30 && r2.length === 30, 'שתי הקריאות החזירו נתונים');
  ok(netCount === 3, 'אין כפילות בקשות רשת לסימבול — 3 קריאות המרוץ פעם אחת (נטו: ' + netCount + ')');

  T._setDB({ source: 'manual' });

  /* ---------- v54: המרות מט"ח לא מעוותות את השחזור; דיבידנד = תשואה ---------- */
  ok(T.ibkrIsStockTrade({ symbol: 'AAPL' }), 'מניה נחשבת עסקת מניה');
  ok(!T.ibkrIsStockTrade({ symbol: 'USD.ILS' }), 'המרת מט"ח לא עסקת מניה');
  ok(!T.ibkrIsStockTrade({ symbol: 'AAPL  260919C00150000' }), 'אופציה לא עסקת מניה');
  ok(T.ibkrIsDividendTx({ type: 'Dividends', description: 'AAPL' }), 'דיבידנד מזוהה');
  ok(T.ibkrIsDividendTx({ type: 'Withholding Tax', description: '' }), 'מס דיבידנד מזוהה');
  ok(!T.ibkrIsDividendTx({ type: 'Deposit', description: 'Deposit' }), 'הפקדה לא דיבידנד');

  { // המרת מט"ח באמצע לא מנפחת עבר: מזומן קבוע + מניה קבועה -> TWR שטוח 0%
    const h = hist30('AAA', 100, 100, '2026-01-01');
    const rows = T.buildTradesHistory({
      trades: [
        { date: '2026-01-05', symbol: 'AAA', side: 'BUY', qty: 10, price: 100, commission: 0, currency: 'USD', fxToBase: 1 },
        { date: '2026-02-01', symbol: 'USD.ILS', side: 'BUY', qty: 1000, price: 3.5, commission: 0, currency: 'ILS', fxToBase: 1 / 3.5 },
      ],
      cashTx: [],
      positions: [{ sym: 'AAA', shares: 10 }],
      cash: { usd: 1000, ils: 0 },
      hist: { AAA: h },
      fxOf,
    });
    const bad = rows.some((r) => Math.abs(r.value - 100) > 1);
    ok(!bad, 'המרת מט"ח לא מעוותת את הגרף — TWR שטוח, ערכים: ' + rows.slice(0, 3).map((r) => r.value.toFixed(1)).join(','));
  }

  { // דיבידנד 100$ על תיק 1000$ -> TWR סופי +10% (בלי התיקון היה נשאר 0%)
    const h = hist30('AAA', 100, 100, '2026-01-01');
    const rows = T.buildTradesHistory({
      trades: [
        { date: '2026-01-05', symbol: 'AAA', side: 'BUY', qty: 10, price: 100, commission: 0, currency: 'USD', fxToBase: 1 },
      ],
      cashTx: [
        { date: '2026-01-15', amount: 100, currency: 'USD', fxToBase: 1, type: 'Dividends', description: 'AAA dividend' },
      ],
      positions: [{ sym: 'AAA', shares: 10 }],
      cash: { usd: 100, ils: 0 },
      hist: { AAA: h },
      fxOf,
    });
    const ret = rows[rows.length - 1].value / 100 - 1;
    ok(Math.abs(ret - 0.10) < 0.01, 'דיבידנד נספר כתשואה +10%, בפועל ' + (ret * 100).toFixed(2) + '%');
  }

  { // v56: מדידה דולרית טהורה — שער חליפין משתנה (3.4->3.0) לא מזהם את התשואה
    // מניה שטוחה $100 + $1000 מזומן — תשואה אמיתית 0%. בקוד הישן: ‎-11.8%‎
    const h = hist30('AAA', 100, 100, '2026-01-01');
    const fxMove = (iso) => (iso < '2026-01-16' ? 3.4 : 3.0);
    const rows = T.buildTradesHistory({
      trades: [{ date: '2026-01-05', symbol: 'AAA', side: 'BUY', qty: 10, price: 100, commission: 0, currency: 'USD', fxToBase: 1 }],
      cashTx: [],
      positions: [{ sym: 'AAA', shares: 10 }],
      cash: { usd: 1000, ils: 0 },
      hist: { AAA: h },
      fxOf: fxMove,
    });
    const ret = rows[rows.length - 1].value / 100 - 1;
    ok(Math.abs(ret) < 0.01, 'שינוי שער לא מזהם — TWR ~0%, בפועל ' + (ret * 100).toFixed(2) + '%');
  }

  { // v56: מזומן שקלי מומר פעם אחת לדולרים בשער העדכני — ₪3000 בשער 3.0 ≡ $1000
    const h = hist30('AAA', 100, 110, '2026-01-01');
    const fxC = () => 3.0;
    const mk = (cash) => T.buildTradesHistory({
      trades: [{ date: '2026-01-05', symbol: 'AAA', side: 'BUY', qty: 10, price: 100, commission: 0, currency: 'USD', fxToBase: 1 }],
      cashTx: [],
      positions: [{ sym: 'AAA', shares: 10 }],
      hist: { AAA: h },
      fxOf: fxC,
      cash,
    });
    const r1 = mk({ usd: 1000, ils: 0 });
    const r2 = mk({ usd: 0, ils: 3000 });
    const ret1 = r1[r1.length - 1].value / 100 - 1, ret2 = r2[r2.length - 1].value / 100 - 1;
    ok(Math.abs(ret1 - ret2) < 1e-9, '₪3000 ≡ $1000 — אותה תשואה, בפועל ' + (ret1 * 100).toFixed(2) + '% / ' + (ret2 * 100).toFixed(2) + '%');
    ok(Math.abs(ret2 - 0.05) < 0.015, 'TWR אמיתי +5% ($1000 מניה +10% על $2000), בפועל ' + (ret2 * 100).toFixed(2) + '%');
  }

  console.log('\nכל הבדיקות עברו: ' + n);
})().catch((e) => { console.error('נכשל:', e); process.exit(1); });
