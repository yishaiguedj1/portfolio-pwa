/* v74 QA: תיקון ספליטים ידועים רץ תמיד (לא רק כשחסר מטא).
   התרחיש: מטמון שומר splitsApplied שגוי (למשל "מותאם" כשהמחירים לא
   הותאמו) — לפני v74 התיקון דילג והשחזור התעוות (מקסימום ‎-12%‎).
   Run: node tests/pf-v74.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
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
const sandbox = {
  localStorage, document, window: {}, navigator: {}, location: {},
  AbortController, fetch: (...a) => fetch(...a),
  setTimeout, clearTimeout, console,
};
vm.createContext(sandbox);
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
vm.runInContext(src + ';globalThis.__t={repairKnownSplits,restoreHistRows,_state:()=>state};', sandbox);
const T = sandbox.__t;

// בונה שורות NOW עם מחירים לא־מותאמים (לפני הספליט גבוהים פי 5)
function nowUnadjusted() {
  const rows = [];
  for (let d = new Date('2025-12-01T12:00:00Z'); d <= new Date('2026-01-10T12:00:00Z'); d = new Date(d.getTime() + 86400000)) {
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const dt = d.toISOString().slice(0, 10);
    const c = dt < '2025-12-18' ? 775 : 155; // לא מותאם: 775 לפני, 155 אחרי
    rows.push({ date: dt, close: c });
  }
  return rows;
}

// 1. מטא שגוי ("מותאם") + מחירים לא מותאמים → התיקון מתקן מחירים
{
  const rows = nowUnadjusted();
  rows.splitsApplied = '2025-12-18×5'; // מטא שקרי: טוען שהמחירים מותאמים
  const fixed = T.repairKnownSplits('NOW', rows);
  ok(fixed, 'תיקון זיהה מחירים לא־מותאמים למרות מטא קיים');
  const pre = rows.find((r) => r.date === '2025-12-17');
  ok(Math.abs(pre.close - 155) < 1, `מחיר טרום־ספליט תוקן: ${pre.close} (≈155)`);
}

// 2. מטא חסר + מחירים לא מותאמים → מתקן (כמו קודם)
{
  const rows = nowUnadjusted();
  const fixed = T.repairKnownSplits('NOW', rows);
  ok(fixed, 'תיקון עובד גם בלי מטא');
  ok(String(rows.splitsApplied).includes('2025-12-18'), 'מטא נוסף');
}

// 3. מחירים כבר מותאמים + מטא נכון → לא שובר
{
  const rows = [];
  for (let d = new Date('2025-12-01T12:00:00Z'); d <= new Date('2026-01-10T12:00:00Z'); d = new Date(d.getTime() + 86400000)) {
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const dt = d.toISOString().slice(0, 10);
    rows.push({ date: dt, close: 155 }); // כבר מותאם
  }
  rows.splitsApplied = '2025-12-18×5';
  T.repairKnownSplits('NOW', rows);
  const pre = rows.find((r) => r.date === '2025-12-17');
  ok(Math.abs(pre.close - 155) < 1, 'מחיר מותאם לא שונה');
}

// 4. restoreHistRows מריץ תיקון גם כשיש מטא שמור
{
  const rows = nowUnadjusted();
  const cached = { at: Date.now(), rows: rows, splits: '2025-12-18×5' };
  T.restoreHistRows('NOW', cached);
  const st = T._state().hist['NOW'];
  const pre = st.find((r) => r.date === '2025-12-17');
  ok(Math.abs(pre.close - 155) < 1, `restoreHistRows תיקן למרות מטא שמור: ${pre.close}`);
}

console.log(`\n${n} בדיקות v74 עברו ✓`);
