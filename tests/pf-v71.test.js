'use strict';
/* בדיקות v71: עמידות מטמון ההיסטוריה —
   1. repairKnownSplits מתקן שורות v1 (מותאמות/לא־מותאמות) ומצרף מטא־ספליטים
   2. migrateHistCacheV1 מעתיק v1→v2 עם תיקון, בלי רשת
   3. stale-while-revalidate: מטמון פג־תוקף מוחזר מיד גם כשהרשת תלויה
   4. TWR מקצה־לקצה עם עסקת NOW טרום־ספליט אחרי נדידה (תרחיש טווח־מקסימום)
   5. מטא־ספליטים שורדים JSON round-trip (ליבת תיקון v70) */
const fs = require('fs'), path = require('path'), vm = require('vm');

function makeLS() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _map: m,
  };
}
// רשת תלויה לנצח — מוכיח שהמטמון מוחזר בלי לחכות לרשת
const hangingFetch = () => new Promise(() => {});
const sandbox = {
  localStorage: makeLS(),
  document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], createElement: () => ({}) },
  window: {}, navigator: {}, location: {}, AbortController, fetch: hangingFetch,
  setTimeout, clearTimeout, console,
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8') +
  '\n;globalThis.__t={repairKnownSplits,migrateHistCacheV1,loadHistCacheRec,restoreHistRows,' +
  'getDailyFast,buildTradesHistory,applySplitAdjustment};', sandbox, { filename: 'app.js' });
const T = sandbox.__t;
let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
const iso = (d) => d.toISOString().slice(0, 10);
// שורות NOW סינתטיות סביב הספליט 2025-12-18; adjusted=true → מחירים רציפים (~140)
function nowRows(adjusted) {
  const rows = [];
  const d0 = new Date('2025-11-01T12:00:00Z'), d1 = new Date('2026-09-23T12:00:00Z');
  let i = 0;
  for (let t = d0.getTime(); t <= d1.getTime(); t += 864e5, i++) {
    const d = iso(new Date(t));
    const base = 135 + i * 0.05; // עלייה מתונה אחרי הספליט
    const c = d < '2025-12-18' ? (adjusted ? base : base * 5) : base;
    rows.push({ date: d, open: c * 0.99, high: c * 1.01, low: c * 0.98, close: c, volume: 1000 });
  }
  return rows;
}

// 1. שורות כבר־מותאמות: רק מטא מצורף, מחירים לא משתנים
{
  const rows = nowRows(true);
  const before = rows[0].close;
  const fixed = T.repairKnownSplits('NOW', rows);
  ok('מותאם: זוהה ותוקן', fixed === true);
  ok('מותאם: מטא צורף', rows.splitsApplied === '2025-12-18×5');
  ok('מותאם: מחיר לא השתנה', Math.abs(rows[0].close - before) < 1e-9);
}
// 2. שורות לא־מותאמות (טרום־v59): מחירי עבר מחולקים ב־5
{
  const rows = nowRows(false);
  const preBefore = rows[0].close, postBefore = rows[rows.length - 1].close;
  const fixed = T.repairKnownSplits('now', rows); // אותיות קטנות — נורמליזציה
  ok('לא־מותאם: זוהה ותוקן', fixed === true);
  ok('לא־מותאם: מחיר עבר חולק ב־5', Math.abs(rows[0].close - preBefore / 5) < 1e-9);
  ok('לא־מותאם: מחיר אחרי ספליט לא נגע', Math.abs(rows[rows.length - 1].close - postBefore) < 1e-9);
  ok('לא־מותאם: מטא צורף', rows.splitsApplied === '2025-12-18×5');
  ok('לא־מותאם: רציפות סביב הספליט', Math.abs(rows[0].close - postBefore) / postBefore < 0.3);
}
// 3. שורות שלא חוצות את הספליט: מחירים לא משתנים, אבל מטא נקבע (v77 — עסקאות צריכות אותו)
{
  const rows = [];
  for (let i = 0; i < 30; i++) {
    const d = iso(new Date(new Date('2026-06-01T12:00:00Z').getTime() + i * 864e5));
    rows.push({ date: d, close: 140 + i });
  }
  const before = rows.map((r) => r.close).join(',');
  ok('בלי חצייה: מטא נקבע (v77)', T.repairKnownSplits('NOW', rows) === true && !!rows.splitsApplied);
  ok('בלי חצייה: מחירים לא השתנו', rows.map((r) => r.close).join(',') === before);
  ok('סימבול לא ידוע: לא תוקן', T.repairKnownSplits('ZZZ', nowRows(true)) === false);
}
// 4. נדידה v1→v2 בלי רשת
{
  const rows = nowRows(false); // הכי קשה: לא מותאם + אין מטא (כמו v1 אמיתי ישן)
  sandbox.localStorage.setItem('pwa_hist_v1_NOW', JSON.stringify({ at: Date.now(), rows }));
  const rec = T.migrateHistCacheV1('NOW');
  ok('נדידה: החזירה רשומה', !!rec);
  ok('נדידה: מטא שוחזר', rec.splits === '2025-12-18×5');
  ok('נדידה: נשמר תחת v2', !!sandbox.localStorage.getItem('pwa_hist_v2_NOW'));
  ok('נדידה: v1 נמחק', sandbox.localStorage.getItem('pwa_hist_v1_NOW') === null);
  const v2 = JSON.parse(sandbox.localStorage.getItem('pwa_hist_v2_NOW'));
  ok('נדידה: מחיר עבר תוקן ב־v2', v2.rows[0].close < 200); // היה ~700, עכשיו ~140
}
// 5. JSON round-trip של הרשומה (ליבת v70) + שחזור
{
  const rec = JSON.parse(sandbox.localStorage.getItem('pwa_hist_v2_NOW'));
  const rt = JSON.parse(JSON.stringify(rec));
  const rows = T.restoreHistRows('NOW', rt);
  ok('round-trip: מטא שוחזר לשורות', rows.splitsApplied === '2025-12-18×5');
}
// 6. stale-while-revalidate: מטמון פג־תוקף מוחזר מיד כשהרשת תלויה
(async () => {
  const rows = nowRows(true);
  rows.splitsApplied = '2025-12-18×5';
  sandbox.localStorage.setItem('pwa_hist_v2_AAA', JSON.stringify({ at: Date.now() - 25 * 3600e3, rows }));
  const winner = await Promise.race([
    T.getDailyFast('AAA', false).then((r) => 'fast'),
    new Promise((res) => setTimeout(() => res('SLOW'), 3000)),
  ]);
  ok('SWR: מטמון פג־תוקף מוחזר מיד (רשת תלויה)', winner === 'fast');
  // 7. TWR מקצה־לקצה אחרי נדידה: קניית NOW טרום־ספליט
  const nrows = nowRows(false);
  sandbox.localStorage.setItem('pwa_hist_v1_NOW', JSON.stringify({ at: Date.now(), rows: nrows }));
  const rec = T.migrateHistCacheV1('NOW');
  const h = rec.rows.map((r) => ({ date: r.date, close: r.close }));
  h.splitsApplied = rec.rows.splitsApplied;
  const tr = T.buildTradesHistory({
    trades: [{ date: '2025-11-10', symbol: 'NOW', side: 'BUY', qty: 20, price: 700, commission: 0, currency: 'USD', fxToBase: 1 }],
    positions: [{ sym: 'NOW', shares: 100 }],
    cash: { usd: 0, ils: 0 }, cashTx: [],
    hist: { NOW: h }, fxOf: () => 3.3,
  });
  const twr = tr.length ? tr[tr.length - 1].value / 100 - 1 : NaN;
  // עצמאי: 20×700=14000$ → 100 מניות × ~150$ ≈ +7%
  ok('TWR אחרי נדידה חיובי ונכון (לא שלילי עמוק)', twr > 0 && twr < 0.25);
  // הוכחת דיסקרימינציה: בלי מטא — המנוע שובר (הבאג של v70)
  const hBad = rec.rows.map((r) => ({ date: r.date, close: r.close })); // בלי splitsApplied
  const trBad = T.buildTradesHistory({
    trades: [{ date: '2025-11-10', symbol: 'NOW', side: 'BUY', qty: 20, price: 700, commission: 0, currency: 'USD', fxToBase: 1 }],
    positions: [{ sym: 'NOW', shares: 100 }],
    cash: { usd: 0, ils: 0 }, cashTx: [],
    hist: { NOW: hBad }, fxOf: () => 3.3,
  });
  const twrBad = trBad.length ? trBad[trBad.length - 1].value / 100 - 1 : NaN;
  ok('בלי מטא — התוצאה שגויה (מוכיח שהבדיקה דיסקרימינטיבית)', !(twrBad > 0 && twrBad < 0.25));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
