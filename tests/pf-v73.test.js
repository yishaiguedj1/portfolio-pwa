/* v73 QA: TWR אמיתי מסדרת NAV רשמית של IBKR — מנטרל תזרימים.
   הבאג: כשהגרף השתמש ב־NAV רשמי (useIbkrNav), חושבה תשואה פשוטה
   (סוף/התחלה − 1) בלי לנטרל הפקדות/משיכות → מקסימום הראה ‎-12%‎
   במקום ‎+48%‎ (TWR של IBKR).
   Run: node tests/pf-v73.test.js */
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
vm.runInContext(src + ';globalThis.__t={navToTwr,ibkrFlowsByDate,ibkrIsDepositTx};', sandbox);
const T = sandbox.__t;

// 1. בלי תזרימים — TWR = תשואה פשוטה
{
  const nav = [
    { date: '2024-01-02', value: 50000 },
    { date: '2024-01-03', value: 51000 },
    { date: '2024-01-04', value: 52500 },
  ];
  const twr = T.navToTwr(nav, {});
  ok(twr.length === 3, 'מחזיר 3 נקודות');
  ok(Math.abs(twr[0].value - 100) < 1e-9, 'מתחיל מ־100');
  // 51000/50000 = 1.02, 52500/51000 = 1.029411...
  const expected = 100 * 1.02 * (52500 / 51000);
  ok(Math.abs(twr[2].value - expected) < 1e-6, 'TWR בלי תזרימים = מכפלת צמיחה');
}

// 2. הפקדה מנוטרלת — לא מנפחת תשואה
{
  // NAV: 50000 → 60000 (הפקדה של 10000) → 61800 (+3% אמיתי)
  const nav = [
    { date: '2024-01-02', value: 50000 },
    { date: '2024-01-03', value: 60000 },
    { date: '2024-01-04', value: 61800 },
  ];
  const flows = { '2024-01-03': 10000 };
  const twr = T.navToTwr(nav, flows);
  // יום 2: (60000-10000)/50000 = 1.0 (אין צמיחה, רק הפקדה)
  // יום 3: 61800/60000 = 1.03
  // TWR = 100 * 1.0 * 1.03 = 103 → +3%
  ok(Math.abs(twr[2].value - 103) < 1e-6, 'הפקדה מנוטרלת: TWR = +3% (לא +23.6%)');
  // תשואה פשוטה הייתה: 61800/50000 - 1 = 23.6% — שגוי!
  const simple = (61800 / 50000 - 1) * 100;
  ok(Math.abs(simple - 23.6) < 0.01, 'תשואה פשוטה הייתה 23.6% (מוטעית)');
}

// 3. משיכה מנוטרלת — לא מפילה תשואה
{
  // NAV: 50000 → 45000 (משיכה של 5000) → 46350 (+3% אמיתי על 45000)
  const nav = [
    { date: '2024-01-02', value: 50000 },
    { date: '2024-01-03', value: 45000 },
    { date: '2024-01-04', value: 46350 },
  ];
  const flows = { '2024-01-03': -5000 };
  const twr = T.navToTwr(nav, flows);
  // יום 2: (45000-(-5000))/50000 = 50000/50000 = 1.0
  // יום 3: 46350/45000 = 1.03
  // TWR = 103 → +3%
  ok(Math.abs(twr[2].value - 103) < 1e-6, 'משיכה מנוטרלת: TWR = +3% (לא -7.3%)');
}

// 4. תרחיש הדיסקרימינציה: הפקדות גדולות + תשואה חיובית אמיתית
//    לפני התיקון: תשואה פשוטה שלילית; אחרי: TWR חיובי כמו IBKR
{
  // מתחיל ב־50000, מפקיד 28614 (כמו בנתוני ישי), מסיים ב־95000
  // תשואה אמיתית: נניח צמיחה של 20% על ההון המושקע
  const nav = [
    { date: '2024-01-03', value: 50000 },
    { date: '2024-06-15', value: 78614 }, // +28614 הפקדה, 0% צמיחה
    { date: '2025-01-02', value: 86400 }, // +10% על 78614
    { date: '2026-09-23', value: 95000 }, // עוד צמיחה
  ];
  const flows = { '2024-06-15': 28614 };
  const twr = T.navToTwr(nav, flows);
  const twrPct = twr[twr.length - 1].value - 100;
  // TWR = (78614-28614)/50000 * 86400/78614 * 95000/86400 - 1
  //     = 1.0 * 1.0991 * 1.0995 - 1 ≈ 20.85%
  ok(twrPct > 15 && twrPct < 25, `TWR חיובי עם הפקדה גדולה: ${twrPct.toFixed(2)}%`);
  // תשואה פשוטה: 95000/50000 - 1 = 90% — מנופחת בגלל ההפקדה
  const simple = (95000 / 50000 - 1) * 100;
  ok(simple > 85, 'תשואה פשוטה מנופחת (90%) בגלל ההפקדה');
}

// 5. הגנה: NAV אפס/שלילי לא שובר
{
  const nav = [
    { date: '2024-01-02', value: 50000 },
    { date: '2024-01-03', value: 0 },
    { date: '2024-01-04', value: 51000 },
  ];
  const twr = T.navToTwr(nav, {});
  ok(twr.length === 3, 'לא נשבר על NAV אפס');
  ok(isFinite(twr[2].value), 'ערך סופי סופי');
}

// 6. פחות מ־2 נקודות → מערך ריק
{
  ok(T.navToTwr([], {}).length === 0, 'ריק על קלט ריק');
  ok(T.navToTwr([{ date: '2024-01-02', value: 1 }], {}).length === 0, 'ריק על נקודה אחת');
}

console.log(`\n${n} בדיקות v73 עברו ✓`);
