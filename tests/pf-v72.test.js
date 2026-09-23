/* v72 QA מקיף: (א) אייקון לוח־שנה נקי בצבע המותג; (ב) מטמון שלילי — מעבר
   טווחים לא שורף timeout רשת שוב על סימבול שנכשל.
   Run: node tests/pf-v72.test.js */
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

let fetchCalls = 0;
let fetchMode = 'fail'; // 'fail' | 'ok' | 'now-ok'
const stooqCSV = 'Date,Open,High,Low,Close,Volume\n' +
  '2026-09-21,1,1,1,100,1\n2026-09-22,1,1,1,101,1\n';
// NOW עם ספליט 5:1 ב־2025-12-18 — מחירים כבר־מותאמים (כמו Yahoo), בלי מטא.
// ההיסטוריה מתחילה לפני תאריך העסקה (2025-09-24) כדי שהעיוות טרום־ספליט ייכלל.
function nowAdjCSV() {
  let csv = 'Date,Open,High,Low,Close,Volume\n';
  for (let d = new Date('2025-09-01T12:00:00Z'); d <= new Date('2026-01-20T12:00:00Z'); d = new Date(d.getTime() + 86400000)) {
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const dt = d.toISOString().slice(0, 10);
    const c = dt < '2025-12-18' ? 140 : 145; // מותאם — אין קפיצה
    csv += `${dt},${c},${c + 1},${c - 1},${c},1000\n`;
  }
  return csv;
}
const sandbox = {
  localStorage, document,
  window: {}, navigator: {}, location: {},
  AbortController,
  fetch: async (url) => {
    fetchCalls++;
    const u = String(url);
    if (fetchMode === 'ok' && u.includes('stooq.com')) {
      return { ok: true, text: async () => stooqCSV };
    }
    if (fetchMode === 'now-ok' && u.includes('stooq.com') && u.includes('s=now.us')) {
      return { ok: true, text: async () => nowAdjCSV() };
    }
    throw new Error('network blocked');
  },
  setTimeout, clearTimeout, console,
};
vm.createContext(sandbox);
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
vm.runInContext(appSrc +
  `\n;globalThis.__t = { getDailyFast, buildTradesHistory, CAL_ICON,
    _t: (k) => t(k),
    _neg: () => histNegCache,
    _negTtl: () => HIST_NEG_TTL_MS,
    _setNeg: (s, ts) => { histNegCache[s] = ts; },
    _state: () => state,
    _reset() { state.hist = {}; state.histDbg = {};
      for (const k of Object.keys(histInflight)) delete histInflight[k];
      for (const k of Object.keys(histNegCache)) delete histNegCache[k]; } };`,
  sandbox, { filename: 'app.js' });
const T = sandbox.__t;
ok(!!T, 'app.js נטען בלי שגיאות תחביר');

(async () => {
/* ---------- (א) אייקון לוח־שנה ---------- */
ok(T.CAL_ICON.includes('<svg') && T.CAL_ICON.includes('stroke="var(--primary)"'),
  'CAL_ICON: SVG נקי בצבע המותג var(--primary)');
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(T.CAL_ICON), 'CAL_ICON: בלי אימוג׳י');
ok(T.CAL_ICON.includes('aria-hidden="true"'), 'CAL_ICON: aria-hidden לנגישות');

for (const lit of ["pfFromBtn: '📅", 'pfPickFromCal: \'📅', 'pfFromBtn: "📅', "pfPickFromCal: '📅"]) {
  ok(!appSrc.includes(lit), 'אין 📅 במחרוזות i18n: ' + lit.slice(0, 18));
}
ok(T._t('pfFromBtn') === 'תשואה מתאריך', 'עברית: pfFromBtn טקסט נקי');
ok(T._t('pfPickFromCal') === 'בחר מהיומן', 'עברית: pfPickFromCal טקסט נקי');
ok(cssSrc.includes('.ic {') || cssSrc.includes('.ic{'), 'styles.css: מחלקת .ic קיימת');
ok(/\.ic\s*\{[^}]*1\.15em/.test(cssSrc), 'styles.css: .ic בגודל em יחסי');
ok(appSrc.includes("CAL_ICON + esc(t('pfFromBtn'))"), 'כפתור הסרגל: אייקון + טקסט מחוטא');
ok(appSrc.includes("CAL_ICON + esc(t('pfPickFromCal'))"), 'כפתור הגיליון: אייקון + טקסט מחוטא');
ok(appSrc.includes("h.textContent = t('pfFromBtn')"), 'כותרת הגיליון: טקסט בלבד (בלי דליפת SVG)');

/* ---------- (ב) מטמון שלילי ---------- */
T._reset();
fetchMode = 'fail'; fetchCalls = 0;
const r1 = await T.getDailyFast('ZZFAIL', false);
ok(Array.isArray(r1) && r1.length === 0, 'כשלון מוחלט מחזיר []');
const negTs = T._neg()['ZZFAIL'];
ok(typeof negTs === 'number' && Date.now() - negTs < 5000, 'כשלון נרשם במטמון השלילי');

const c1 = fetchCalls;
const r2 = await T.getDailyFast('ZZFAIL', false);
ok(fetchCalls === c1, 'קריאה חוזרת בתוך החלון: אפס קריאות רשת');
ok(Array.isArray(r2) && r2.length === 0, 'קריאה חוזרת מחזירה [] מיד');

const c2 = fetchCalls;
await T.getDailyFast('ZZFAIL', true); // force=true עוקף (רענון רקע)
ok(fetchCalls > c2, 'force=true עוקף מטמון שלילי ומנסה רשת');

// מטמון פג־תוקף מוחזר בחלון השלילי — בלי רשת
T._reset();
store['pwa_hist_v2_ZZSTALE'] = JSON.stringify({
  at: Date.now() - 30 * 3600 * 1000, // פג־תוקף (מעל 24 שעות)
  rows: [{ date: '2026-09-01', close: 50 }, { date: '2026-09-02', close: 51 }],
  splits: null,
});
fetchMode = 'fail'; fetchCalls = 0;
await T.getDailyFast('ZZSTALE', false); // נכשל → נרשם שלילי, מחזיר stale
// הרשומה השלילית נכתבת ע״י רענון הרקע — ממתינים שיסתיים
await new Promise((r) => setTimeout(r, 100));
ok(T._neg()['ZZSTALE'] > 0, 'סימבול עם מטמון פג־תוקף נרשם שלילי אחרי כשלון רשת');
const c3 = fetchCalls;
const r3 = await T.getDailyFast('ZZSTALE', false);
ok(fetchCalls === c3, 'בחלון השלילי: מטמון פג־תוקף מוחזר בלי רשת');
ok(r3.length === 2 && T._state().hist['ZZSTALE'].length === 2, 'השורות הפגות־תוקף זמינות ב־state.hist');

// הצלחה מבטלת מטמון שלילי
T._reset(); fetchMode = 'fail'; fetchCalls = 0;
await T.getDailyFast('ZZOK', false);
ok(T._neg()['ZZOK'] > 0, 'ZZOK נרשם שלילי אחרי כשלון');
fetchMode = 'ok';
await T.getDailyFast('ZZOK', true); // רשת חוזרת → הצלחה דרך Stooq
ok(T._state().hist['ZZOK'] && T._state().hist['ZZOK'].length === 2, 'אחרי הצלחה: היסטוריה ב־state.hist');
ok(!T._neg()['ZZOK'], 'הצלחה מחקה רשומה שלילית');
const c4 = fetchCalls;
await T.getDailyFast('ZZOK', false);
ok(fetchCalls === c4, 'אחרי הצלחה: state.hist מחזיר מיד בלי רשת');

// תפוגת החלון (10 דקות) → מנסים רשת שוב
T._reset(); fetchMode = 'fail'; fetchCalls = 0;
T._setNeg('ZZEXP', Date.now() - T._negTtl() - 1000);
await T.getDailyFast('ZZEXP', false);
ok(fetchCalls > 0, 'אחרי תפוגת החלון: מנסים רשת שוב');

// מסלול תקין לא נפגע: מטמון טרי → בלי רשת, בלי רשומה שלילית
T._reset();
store['pwa_hist_v2_ZZFRESH'] = JSON.stringify({
  at: Date.now() - 3600 * 1000,
  rows: [{ date: '2026-09-22', close: 77 }],
  splits: null,
});
fetchMode = 'fail'; fetchCalls = 0;
const rf = await T.getDailyFast('ZZFRESH', false);
ok(fetchCalls === 0 && rf.length === 1, 'מטמון טרי: אפס רשת');
ok(!T._neg()['ZZFRESH'], 'מטמון טרי: אין רשומה שלילית');

/* ---------- (ג) repair בנתיב save() — באג שיורי v71 ---------- */
/* fetch טרי של NOW עם מחירים כבר־מותאמים (כמו Yahoo): בלי התיקון, save()
   שומר בלי מטא־ספליט ו־buildTradesHistory לא ממיר עסקת טרום־ספליט → TWR
   שלילי עמוק (‎-12%‎ אצל המשתמש במקום ‎+47.95%‎). */
T._reset(); fetchMode = 'now-ok'; fetchCalls = 0;
const nowRows = await T.getDailyFast('NOW', true);
ok(nowRows.length > 10, 'NOW: fetch טרי החזיר שורות');
ok(String(nowRows.splitsApplied || '').includes('2025-12-18'),
  'save() מוסיף מטא־ספליט 2025-12-18×5 בנתיב fetch טרי');
const preRow = nowRows.find((r) => r.date === '2025-12-10');
ok(preRow && Math.abs(preRow.close - 140) < 5,
  'מחירים כבר־מותאמים לא חולקו שוב (נשארו ~140, לא ~28)');
// אידמפוטנטיות: repair שני לא מכפיל מטא ולא מחלק שוב
await T.getDailyFast('NOW', true);
const meta2 = String(T._state().hist['NOW'].splitsApplied || '');
ok(meta2.split(',').filter((m) => m.includes('2025-12-18')).length === 1, 'אין כפילות מטא־ספליט');
const preRow2 = T._state().hist['NOW'].find((r) => r.date === '2025-12-10');
ok(preRow2 && Math.abs(preRow2.close - 140) < 5, 'אין חלוקה כפולה של מחירים');

// E2E: עסקת NOW טרום־ספליט (20 יח׳ @ $700 ב־2025-09-24) מול היסטוריה מתוקנת
const mkO = (histRows) => ({
  trades: [{ date: '2025-09-24', symbol: 'NOW', qty: 20, price: 700, commission: 1,
             side: 'BUY', asset: 'STK', currency: 'USD', fxToBase: 1 }],
  cashTx: [], divTx: [],
  positions: [{ sym: 'NOW', shares: 100 }], // 20×5 אחרי הספליט
  cash: { usd: 0, ils: 0 },
  hist: { NOW: histRows },
  fxOf: () => 1,
});
const twrFixed = T.buildTradesHistory(mkO(T._state().hist['NOW']));
// buildTradesHistory מחזיר ערכים מנורמלים ל־100 (כמו ב־pf-v71.test.js)
const twrPct = twrFixed.length ? (twrFixed[twrFixed.length - 1].value / 100 - 1) * 100 : NaN;
ok(Number.isFinite(twrPct) && twrPct > -5,
  'TWR עם מטא מתוקן: ' + (Number.isFinite(twrPct) ? twrPct.toFixed(2) : '?') + '% (לא שלילי עמוק)');
// בקרת דיסקרימינציה: אותו תרחיש בלי מטא (באג v71) → שלילי עמוק
const brokenRows = T._state().hist['NOW'].slice();
delete brokenRows.splitsApplied;
const twrBroken = T.buildTradesHistory(mkO(brokenRows));
const twrBrokenPct = twrBroken.length ? (twrBroken[twrBroken.length - 1].value / 100 - 1) * 100 : NaN;
ok(Number.isFinite(twrBrokenPct) && twrBrokenPct < -20,
  'בלי מטא (באג): TWR=' + (Number.isFinite(twrBrokenPct) ? twrBrokenPct.toFixed(1) : '?') + '% — הבדיקה דיסקרימינטיבית');

console.log('\nכל ' + n + ' בדיקות v72 עברו ✓');
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
