// 26/10/2026 — כלי ההשוואה (ibkr-proxy/lib/fundxcheck.js): השקעות הוניות — תגית מורכבת, השנה הפתוחה, סימן. נתונים סינתטיים. הרצה: node tests/fund-xcheck-capex.test.js
const path = require('path');
const X = require(path.join(__dirname, '..', 'ibkr-proxy/lib/fundxcheck.js'));
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const fct = (rows) => ({ val: rows[2], start: rows[0], end: rows[1], form: rows[3], filed: rows[4] });
const facts = (tags) => ({ facts: { 'us-gaap': Object.fromEntries(Object.entries(tags).map(([t, rows]) => [t, { units: { USD: rows.map(fct) } }])) } });
const F = facts({
  PaymentsToAcquirePropertyPlantAndEquipment: [['2024-01-01', '2024-12-31', 257e6, '10-K', '2025-02-01'], ['2025-01-01', '2025-03-31', 60e6, '10-Q', '2025-05-01'], ['2025-01-01', '2025-06-30', 130e6, '10-Q', '2025-08-01']],
  PaymentsToDevelopSoftware: [['2024-01-01', '2024-12-31', 348e6, '10-K', '2025-02-01'], ['2025-01-01', '2025-03-31', 90e6, '10-Q', '2025-05-01'], ['2025-01-01', '2025-06-30', 180e6, '10-Q', '2025-08-01']],
});
const d = { ok: true, cur: 'USD', fy: ['2023-12-31', '2024-12-31'], q: ['2025-03-31', '2025-06-30'], tags: { capex: 'PaymentsToAcquirePropertyPlantAndEquipment+PaymentsToDevelopSoftware' },
  A: { capex: [null, 605e6], rev: [1e9, 1e9] }, Q: { capex: [150e6, 160e6] }, derived: { capex: ['2025-06-30'] } };
const y = { fy: ['2024-12-31'], q: ['2025-03-31', '2025-06-30'], A: { capex: [605e6] }, Q: { capex: [150e6, 160e6] } };
const nq = { A: { ends: ['2024-12-31'], v: { capex: { '2024-12-31': 257e6 } } }, Q: { ends: ['2025-06-30'], v: { capex: { '2025-06-30': 70e6 } } } };
const r = X.xcheck(d, F, y, nq), at = (k, p) => r.find((x) => x.m === 'capex' && x.k === k && x.p === p);
ok(at('A', '2024-12-31').raw === 605e6 && at('A', '2024-12-31').c === 'def', 'תגית מורכבת (רכוש קבוע + תוכנה): SEC גולמי = סכום החלקים → def מול Nasdaq (רק השורה הראשונה)');
ok(at('Q', '2025-06-30').raw === 160e6 && at('Q', '2025-06-30').c === 'def', 'השנה הפתוחה: רבעון מחושב (6 חודשים − 3) מקבל SEC גולמי');
// רבעון רביעי שלילי בחיסור הנאיבי — לא ערך ייחוס; נטו (רוב הערכים שליליים) — הסימן מתהפך לכל הסדרה
const G = facts({ PaymentsToAcquireProductiveAssets: [['2024-01-01', '2024-09-30', 376e6, '10-Q', '2025-11-06'], ['2024-01-01', '2024-12-31', 285e6, '10-K', '2026-02-17']] });
const d2 = { ok: true, cur: 'USD', fy: ['2023-12-31', '2024-12-31'], q: ['2024-12-31'], tags: { capex: 'PaymentsToAcquireProductiveAssets' }, A: { capex: [null, 285e6], rev: [1, 1] }, Q: { capex: [161e6] }, derived: { capex: ['2024-12-31'] } };
const r2 = X.xcheck(d2, G, null, null).find((x) => x.k === 'Q');
ok(r2.raw == null && r2.c !== 'bug', 'השקעות הוניות: חיסור נאיבי שלילי (‎285 − 376) — לא "bug" מול הערך שלנו');
const H = facts({ PaymentsToAcquirePropertyPlantAndEquipment: [['2024-01-01', '2024-09-30', 171e6, '10-Q', '2024-10-24'], ['2024-01-01', '2024-12-31', 145e6, '10-K', '2025-02-21']] });
const d3 = { ok: true, cur: 'USD', fy: ['2023-12-31', '2024-12-31'], q: ['2024-12-31'], tags: { capex: 'PaymentsToAcquirePropertyPlantAndEquipment' }, A: { capex: [null, 145e6], rev: [1, 1] }, Q: { capex: [-26e6] }, derived: { capex: ['2024-12-31'] } };
const r3 = X.xcheck(d3, H, null, null).find((x) => x.k === 'Q');
ok(r3.raw === -26e6 && r3.c !== 'bug', 'נטו אחרי מכירות (Hartford ‏145 − 171): SEC גולמי ‎−26 כמו אצלנו — לא Math.abs');
console.log(`\nכל ${n} הבדיקות עברו ✓`);
