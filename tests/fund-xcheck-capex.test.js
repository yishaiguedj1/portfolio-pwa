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
// ---- סבב 3 (26/10/2026) ----
const cfFace = (rows, ends = ['2025-12-31']) => ({ cf: { title: '', cols: ends.map((end) => ({ end, months: 12 })), scale: { cur: 1, sh: 1 },
  rows: rows.map(([tag, label, v]) => ({ ns: /:/.test(tag) ? tag.split(':')[0] : 'us-gaap', tag: tag.split(':').pop(), label, v: Array.isArray(v) ? v : [v] })) } });
const yA = (v) => ({ fy: ['2025-12-31'], q: [], A: { capex: [v] }, Q: {} }), nA = (v) => ({ A: { ends: ['2025-12-31'], v: { capex: { '2025-12-31': v } } } });
const at1 = (r) => r.find((x) => x.m === 'capex' && x.k === 'A' && x.p === '2025-12-31');
// Ventas / United Rentals: השרתון הוריד את התגית (השקעה הונית בשורה פרטית) והשלים מ־Yahoo — לא "bug" מול תגית מועמדת שנדחתה
const V = facts({ PaymentsToAcquireProductiveAssets: [['2025-01-01', '2025-12-31', 2928e6, '10-K', '2026-02-12']] });
const dv = { ok: true, cur: 'USD', fy: ['2024-12-31', '2025-12-31'], q: [], tags: {}, fill: ['capex'], A: { capex: [604e6, 644.6e6], rev: [1, 1] }, Q: {} };
const rv = at1(X.xcheck(dv, V, yA(644.6e6), nA(2938e6), { cand: { capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'] } }));
ok(rv.raw == null && rv.c === 'yfill', 'השקעות הוניות שהושלמו מ־Yahoo אחרי שהתגית נדחתה — yfill, לא bug מול PaymentsToAcquireProductiveAssets (Ventas)');
// Weyerhaeuser: השנה מהסכום שהודפס (ffill בלי תגית); Yahoo ו־Nasdaq מוסיפים "Acquisition of timberlands"
const dw = { ok: true, cur: 'USD', fy: ['2024-12-31', '2025-12-31'], q: [], tags: {}, checks: [{ k: 'ffill', m: 'capex', p: '2025-12-31', f: 474e6, v: null }], A: { capex: [416e6, 474e6], rev: [1, 1] }, Q: {} };
const rw = at1(X.xcheck(dw, facts({}), yA(943e6), nA(943e6), { face: cfFace([['wy:PaymentsForCapitalExpendituresOfPropertyPlantAndEquipment', 'Capital expenditures for property and equipment', -423e6],
  ['PaymentsForCapitalImprovements', 'Capital expenditures for timberlands reforestation', -51e6], ['PaymentsToAcquireTimberlands', 'Acquisition of timberlands (Note 4)', -469e6]]) }));
ok(rw.raw === 474e6 && rw.c === 'okd' && rw.why === 'capex_acq', 'שנה מהדוח (ffill): הדוח הוא הייחוס, והמקורות = אנחנו + רכישת היערות → okd capex_acq');
// APA: ‏"Additions to oil and gas property" ‏2313; המקורות מוסיפים שתי שורות רכישה (24 + 20)
const A1 = facts({ PaymentsToExploreAndDevelopOilAndGasProperties: [['2025-01-01', '2025-12-31', 2313e6, '10-K', '2026-02-20']] });
const da = { ok: true, cur: 'USD', fy: ['2024-12-31', '2025-12-31'], q: [], tags: { capex: 'PaymentsToExploreAndDevelopOilAndGasProperties' }, A: { capex: [2.8e9, 2313e6], rev: [1, 1] }, Q: {} };
const ra = at1(X.xcheck(da, A1, yA(2357e6), nA(2357e6), { face: cfFace([['PaymentsToExploreAndDevelopOilAndGasProperties', 'Additions to oil and gas property', -2313e6],
  ['apa:PaymentsToAcquireOilAndGasPropertiesProved', 'Acquisition of Delaware Basin properties', -24e6], ['apa:PaymentsToAcquireOilAndGasPropertiesUnprovedLeasehold', 'Leasehold and property acquisitions', -20e6]]) }));
ok(ra.c === 'okd' && ra.why === 'capex_acq', 'המקור = אנחנו + כמה שורות רכישה מודפסות (fsum) — okd capex_acq (APA)');
// Valero: אנחנו (‏PaymentsToAcquireProductiveAssets) כולל "Deferred turnaround and catalyst" — המקורות רק "Capital expenditures"
const VL = facts({ PaymentsToAcquireProductiveAssets: [['2025-01-01', '2025-12-31', 2057e6, '10-K', '2026-02-20']] });
const dl = { ok: true, cur: 'USD', fy: ['2024-12-31', '2025-12-31'], q: [], tags: { capex: 'PaymentsToAcquireProductiveAssets' }, A: { capex: [1.9e9, 2057e6], rev: [1, 1] }, Q: {} };
const rl = at1(X.xcheck(dl, VL, yA(907e6), nA(907e6), { face: cfFace([['PaymentsToAcquirePropertyPlantAndEquipment', 'Capital expenditures', -649e6], ['PaymentsForCapitalImprovements', 'Deferred turnaround and catalyst cost expenditures', -1079e6],
  ['PaymentsToAcquirePropertyPlantAndEquipment', 'Capital expenditures', -250e6], ['PaymentsForCapitalImprovements', 'Deferred turnaround and catalyst cost expenditures', -71e6]]) }));
ok(rl.c === 'okd' && rl.why === 'capex_turn', 'המקור = אנחנו פחות הטורנראונד (כל השורות) — okd capex_turn (Valero)');
// Aptiv: רבעון שלישי = תשעה חודשים פחות חצי שנה כפי שהוגשו (489 − 346 = 143); המקורות: 489 − 267 (חצי השנה שהוצגה מחדש ב־2026)
const AP = facts({ PaymentsToAcquireProductiveAssets: [['2025-01-01', '2025-03-31', 197e6, '10-Q', '2025-05-01'], ['2025-01-01', '2025-06-30', 346e6, '10-Q', '2025-07-31'],
  ['2025-01-01', '2025-06-30', 267e6, '10-Q', '2026-08-04'], ['2025-01-01', '2025-09-30', 489e6, '10-Q', '2025-10-30'], ['2025-01-01', '2025-12-31', 656e6, '10-K', '2026-02-06'],
  ['2024-01-01', '2024-12-31', 800e6, '10-K', '2025-02-06']] });
const dp = { ok: true, cur: 'USD', fy: ['2024-12-31', '2025-12-31'], q: ['2025-09-30'], tags: { capex: 'PaymentsToAcquireProductiveAssets' }, A: { capex: [800e6, 656e6], rev: [4e9, 4e9] }, Q: { capex: [143e6] }, derived: { capex: ['2025-09-30'] } };
const rp = X.xcheck(dp, AP, { fy: ['2025-12-31'], q: ['2025-09-30'], A: { capex: [656e6] }, Q: { capex: [222e6] } }, { A: { ends: [], v: {} }, Q: { ends: ['2025-09-30'], v: { capex: { '2025-09-30': 222e6 } } } }).find((x) => x.k === 'Q');
ok(rp.rf === 'asfiled' && rp.c === 'okd' && rp.why === 'q_naive', 'רבעון מחושב כפי שהוגש, והמקורות = חיסור של שני בסיסים — okd q_naive (Aptiv)');
console.log(`\nכל ${n} הבדיקות עברו ✓`);
