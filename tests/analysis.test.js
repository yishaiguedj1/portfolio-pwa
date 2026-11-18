// מנתח החברות (analysis.js, 25/10/2026) — הפונקציות הטהורות על חברה סינתטית, מחרוזות בשתי השפות, ושילוב באפליקציה.
// הרצה: node tests/analysis.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let n = 0;
const ok = (c, name) => { n++; assert(c, name); console.log('ok -', name); };
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'analysis.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'analysis.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

/* ---------- טעינה ב־vm (בלי DOM) ---------- */
const sb = { console, Date, Math, JSON };
vm.createContext(sb);
vm.runInContext(src.replace(/^export (async )?(function|const)/gm, '$1$2') + '\n;globalThis.A = _test;', sb);
const A = sb.A;
A.setEnv({ t: (k, v) => k + (v ? JSON.stringify(v) : '') });

/* ---------- חברה סינתטית: 6 שנים קלנדריות, רבעונים, מחירים חודשיים ---------- */
const fy = ['2020-12-31', '2021-12-31', '2022-12-31', '2023-12-31', '2024-12-31', '2025-12-31'];
const rev = [100, 110, 121, 133, 146, 161].map((x) => x * 1e9);
const A0 = {
  rev, gp: rev.map((x) => x * 0.6), op: rev.map((x) => x * 0.25), ni: rev.map((x) => x * 0.2), pretax: rev.map((x) => x * 0.25), tax: rev.map((x) => x * 0.05),
  eps: rev.map((x) => x * 0.2 / 1e9), sh: fy.map(() => 1e9), ocf: rev.map((x) => x * 0.3), capex: rev.map((x) => x * 0.08), sbc: rev.map((x) => x * 0.02),
  dep: rev.map((x) => x * 0.05), int: fy.map(() => 1e9), cash: fy.map(() => 30e9), msec: fy.map(() => 0), debt: fy.map(() => 20e9),
  eq: rev.map((x) => x * 0.9), ta: rev.map((x) => x * 1.5), tl: rev.map((x) => x * 0.6), ca: rev.map((x) => x * 0.6), cl: rev.map((x) => x * 0.3),
  re: rev.map((x) => x * 0.5), ppe: rev.map((x) => x * 0.4), buy: fy.map(() => 5e9), divp: fy.map(() => 0),
};
const q = [], Q = {};
for (const k in A0) Q[k] = [];
const INST = new Set(['cash', 'msec', 'debt', 'eq', 'ta', 'tl', 'ca', 'cl', 're', 'ppe', 'sh']);
fy.forEach((e, i) => ['03-31', '06-30', '09-30', '12-31'].forEach((md) => {
  q.push(e.slice(0, 4) + '-' + md);
  for (const k in A0) Q[k].push(INST.has(k) ? A0[k][i] : A0[k][i] / 4);
}));
// רבעון אחד בשנה הפתוחה (2026) — 12 החודשים האחרונים = 2025 + Q1·26 − Q1·25
q.push('2026-03-31'); for (const k in A0) Q[k].push(INST.has(k) ? A0[k][5] : A0[k][5] / 4 * 1.1);
const px = { t: [], c: [] };
for (let y = 2016; y <= 2026; y++) for (let m = 1; m <= 12; m++) { const ym = y + '-' + String(m).padStart(2, '0'); if (ym > '2026-09') break; px.t.push(ym); px.c.push(200 + (y - 2016) * 20); }
const D = { ok: true, sym: 'SYN', src: 'sec', asOf: '2026-10-25', cur: 'USD', fy, q, A: A0, Q, T: null, prof: { name: 'Synthetic Inc.', exch: 'NYSE', sector: 'Tech', industry: 'Software' },
  price: 400, prev: 390, sharesOut: 1e9, fpe: 18, est: [{ p: '0y', eps: 38, n: 10, rev: 175e9, rn: 10, g: 0.1 }, { p: '+1y', eps: 42, n: 9, rev: 190e9, rn: 9, g: 0.1 }],
  hist: [{ q: '3Q2026', a: 9.6, e: 9.5 }], nextEarn: '2026-11-20', nq: null, px, splits: [], ind: 'Software (System & Application)',
  indData: { bu: 1.2, fpe: 30, om: 0.2, n: 300 }, checks: [{ k: 'eps', p: '2010-12-31' }, { k: 'bal', p: '2024-12-31' }], fill: [] };
const MAC = { ok: true, rf: 0.042, erp: 0.042, rfIL: 0.04, crpIL: 0.02, taxIL: 0.23, ind: { 'Total Market (without financials)': { bu: 1, fpe: 20, om: 0.12, n: 6000 } } };

/* ---------- הכנה ---------- */
const co = A.prep(D, null, 3.7);
ok(co.years.join() === '2020,2021,2022,2023,2024,2025', 'שנות הכספים — לפי תאריך הסיום');
ok(A.hasTTM(co), 'רבעון בשנה הפתוחה = יש 12 חודשים אחרונים');
ok(co.flags.length === 1 && co.flags[0].k === 'bal', 'סימוני האימות — רק בשנים שמוצגות');
const pl = A.periodList(co, 'fy');
ok(pl[pl.length - 1].kind === 'ttm', 'התקופה האחרונה ברשימה השנתית = TTM');
const ttmRev = A.raw(co, 'rev', pl[pl.length - 1]);
ok(Math.abs(ttmRev - (rev[5] / 4 * 3 + rev[5] / 4 * 1.1)) < 1, 'TTM של זרימה = סכום 4 הרבעונים האחרונים');
ok(A.raw(co, 'debt', pl[pl.length - 1]) === 20e9, 'TTM של מאזן = הרבעון האחרון');
const live = A.prep(D, { close: 440, prev: 430 }, 3.7);
ok(live.price === 440 && live.prev === 430, 'מחיר חי מהאפליקציה גובר על המחיר של השרתון');
const ta = A.prep({ ...D, sym: 'SYN.TA', cur: 'USD' }, { close: 1480 }, 3.7);
ok(Math.abs(ta.price - 400) < 1e-9 && ta.fxNote, 'מניה בת״א שמדווחת בדולרים — המחיר בשקלים מומר לדולר');
// דוחות במטבע שאין אליו המרה (16/11/2026, בדיקת העומק: Novo ב־DKK — P/E ‎1.8): בלי מכפילים, בלי היסטוריית מכפילים ובלי בדיקות מחיר
{
  const dk = A.indFix(A.prep({ ...D, sym: 'NVOX', cur: 'DKK' }, { close: 60 }, 3.7), MAC);
  const ck = A.checks(dk, MAC), H = A.multHist(dk);
  ok(dk.fxMix && !co.fxMix && !ta.fxMix && dk.price === 60, 'דוחות ב־DKK ומחיר בדולר — fxMix (המחיר עצמו נשאר לתצוגה)');
  ok(H.t.length === 0 && H.pe.length === 0 && A.multHist(co).t.length > 0, 'בלי המרה — בלי היסטוריית מכפילים');
  ok(ck && !JSON.stringify(ck).includes('NaN'), 'הבדיקות רצות בלי מחיר במטבע הדוחות');
  ok(/anFxMix: 'הדוחות ב־\{c\}/.test(app) && /anFxMix: 'Reports in \{c\}/.test(app), 'הערה בשתי השפות');
}
// ההמרה המלאה (17/11/2026, גל 2 — F6): שער חודשי ויחס ADR מהשרתון (d.fxm) — המחיר למניה רגילה במטבע הדוחות
{
  const px = D.px || { t: ['2026-09', '2026-10'], c: [300, 310] };
  const fxm = { cur: 'TWD', now: 0.03, m: px.t.map((t) => [t, 0.031]), adr: 5 };
  const tw = A.prep({ ...D, sym: 'TSMX', cur: 'TWD', px, fxm }, { close: 375, prev: 370 }, 3.7);
  ok(!tw.fxMix && tw.fxNote && Math.abs(tw.price - 375 / 5 / 0.03) < 1e-6 && Math.abs(tw.prev - 370 / 5 / 0.03) < 1e-6, 'ADR ‏375$ ÷ 5 ÷ 0.03 = NT$2,500 למניה רגילה');
  ok(tw.px.c.every((x, i) => px.c[i] == null ? x == null : Math.abs(x - px.c[i] / 5 / 0.031) < 1e-6), 'ההיסטוריה — בשער של אותו חודש');
  ok(A.multHist(tw).t.length > 0, 'עם המרה — יש היסטוריית מכפילים');
  const gap = A.prep({ ...D, sym: 'TSMX', cur: 'TWD', px, fxm: { ...fxm, m: [] } }, { close: 375 }, 3.7);
  ok(gap.px.c.every((x) => x == null) && !gap.fxMix, 'חודש בלי שער — ריק (לא מחיר בדולר)');
  ok(A.prep({ ...D, sym: 'TSMX', cur: 'TWD', fxm: { ...fxm, adr: null } }, { close: 375 }, 3.7).fxMix, 'בלי יחס ADR ודאי — נשאר fxMix');
  ok(A.prep({ ...D, sym: 'TSMX', cur: 'TWD', fxm: { ...fxm, cur: 'EUR' } }, { close: 375 }, 3.7).fxMix, 'שער של מטבע אחר — לא ממירים');
  ok(/anFxAdr: 'ADR אחד = \{n\}/.test(app) && /anFxAdr: 'One ADR = \{n\}/.test(app), 'הערת ADR בשתי השפות');
}
const many = A.prep({ ...D, fy: Array.from({ length: 15 }, (_, i) => (2011 + i) + '-12-31'), A: Object.fromEntries(Object.keys(A0).map((k) => [k, Array(15).fill(1)])) }, null, 3.7);
ok(many.years.length === 12 && many.years[0] === 2014, 'עד 12 שנים מוצגות');
ok(A.prep({ ...D, sic: 6021 }, null, 3.7).fin && A.prep({ ...D, ind: 'Bank (Money Center)' }, null, 3.7).fin && !co.fin, 'בנקים וביטוח מזוהים (קוד SIC או ענף)');
/* ---------- בנקים וביטוח (עודף תשואה), ריט (FFO), חברה מפסידה ---------- */
const bank = A.indFix(A.prep({ ...D, sic: 6021, ind: 'Bank (Money Center)', indData: { bu: 0.44, bl: 1.1, roe: 0.13, pbv: 1.6, n: 15 } }, null, 3.7), MAC);
const FI = A.finInputs(bank, MAC);
ok(Math.abs(FI.val.capm - (0.042 + 1.1 * 0.042)) < 1e-12, 'בנק: הבטא הממונפת של הענף, בלי מינוף מחדש על הפיקדונות');
ok(FI.val.ke === Math.max(0.10, FI.val.capm), 'שיעור ההיוון: לפחות 10% — הרף של באפט ומנגר; CAPM גבוה יותר גובר');
ok(Math.abs(FI.val.bv - rev[5] * 0.9 / 1e9) < 1e-9, 'הון למניה = ההון בדוח האחרון ÷ המניות');
ok(Math.abs(FI.val.roe - 0.195) < 1e-9 && /anSrcRoeCap/.test(FI.src.roe), 'ROE מתמשך עד פי 1.5 מהענף (22% → 19.5%)');
const rv = A.riValue(FI.val);
ok(Math.abs(rv.ps - FI.val.bv * (0.195 - 0.03) / (FI.val.ke - 0.03)) < 1e-9, 'עודף תשואה: ההון × (ROE − g) ÷ (Ke − g)');
ok(Math.abs(A.impliedRoe(FI.val, rv.ps) - FI.val.roe) < 1e-9, 'ROE שהמחיר מגלם: במחיר = השווי, יוצא ה־ROE שהונח');
ok(A.riValue(FI.val, { roe: 0.02 }) === null, 'ROE מתחת לצמיחה — אין שווי חיובי');
const F1 = A.fairOf(bank, MAC);
ok(F1.kind === 'ri' && F1.bear.ps < F1.base.ps && F1.bull.ps > F1.base.ps, 'בנק: דוב < בסיס < שור גם כשה־ROE בתקרה');
ok(A.uncertainty(bank).s < 0.01, 'בנק: אי־הוודאות לפי תנודתיות ה־ROE');
const reit = A.prep({ ...D, sic: 6798, ind: 'R.E.I.T.' }, null, 3.7);
ok(reit.reit && !reit.fin && A.prep({ ...D, ind: 'Retail (REITs)' }, null, 3.7).reit, 'ריט מזוהה (SIC 6798 או ענף), לא כבנק');
const RI = A.reitInputs(reit), crt = A.ctx(reit, A.periodList(reit, 'fy').pop());
ok(Math.abs(RI.ffops - (crt.ni + crt.dep) / 1e9) < 1e-9, 'FFO = רווח נקי + פחת והפחתות');
ok(RI.m && RI.m[0] <= RI.m[1] && RI.m[1] <= RI.m[2] && A.fairOf(reit, MAC).kind === 'ffo', 'ריט: שווי לפי המחיר ל־FFO של הריט עצמו');
ok(A.multHist(reit).pffo.filter((x) => x > 0).length >= 36 && A.multHist(bank).pb.filter((x) => x > 0).length >= 36, 'היסטוריה חודשית של מחיר ל־FFO ומכפיל הון');
const neg = (a) => a.map((x) => -Math.abs(x));
const lco = A.prep({ ...D, A: { ...A0, ocf: neg(A0.ocf) }, Q: { ...Q, ocf: neg(Q.ocf) } }, null, 3.7);
const L = A.lossView(lco), clo = A.ctx(lco, A.periodList(lco, 'fy').pop());
ok(Math.abs(L.m - clo.op / clo.rev) < 1e-9 && Math.abs(L.r40 - (L.g + L.m)) < 1e-12, 'Rule of 40 = צמיחת הכנסות + שולי רווח תפעולי (לפי ת־ניתוח)');
ok(L.r40 === A.r40Of(lco, A.periodList(lco, 'fy').pop()), 'Rule of 40 — פונקציה אחת לכל מקום שמציג אותו');
ok(Math.abs(L.runway - clo.cashT / -clo.fcf) < 1e-9, 'כמה זמן המזומן מספיק = מזומן ÷ שריפה בשנה');
ok(A.fairOf(lco, MAC) === null && A.fairOf(co, MAC).kind === 'dcf', 'בלי תזרים חיובי — אין DCF; חברה רגילה — DCF');
const small = A.indFix(A.prep({ ...D, indData: { bu: 2, fpe: 90, n: 5 } }, null, 3.7), MAC);
ok(small.ind.n === 6000 && small.indName === 'anIndMarket', 'ענף עם פחות מ־15 חברות — השוואה לשוק כולו');
ok(A.indFix(A.prep(D, null, 3.7), MAC).ind.n === 300, 'ענף גדול נשאר');

/* ---------- מדדים ---------- */
const c = A.ctx(co, A.periodList(co, 'fy').find((p) => p.label === '2025'));
ok(Math.abs(c.om - 0.25) < 1e-9 && Math.abs(c.gm - 0.6) < 1e-9, 'שולי רווח');
ok(Math.abs(c.fcf - rev[5] * 0.22) < 1 && Math.abs(c.fcfsbc - rev[5] * 0.2) < 1, 'תזרים חופשי ותזרים לבעלים (פחות תגמול במניות)');
ok(c.netcash === 10e9, 'מזומן נטו = מזומן + השקעות − חוב');
const [g5, n5] = A.cagrN(co, 'rev', 5);
ok(n5 === 5 && Math.abs(g5 - ((161 / 100) ** (1 / 5) - 1)) < 1e-9, 'CAGR של 5 שנים');

/* ---------- הערכת שווי ---------- */
const I = A.autoInputs(co, MAC);
ok(Math.abs(I.val.g1 - (175e9 / rev[5] - 1)) < 1e-9, 'צמיחה בשנה 1 = קונצנזוס ההכנסות מול השנה האחרונה');
ok(Math.abs(I.val.capm - (0.042 + I.bl * 0.042)) < 1e-12 && I.bl >= 0.8 && I.bl <= 2, 'CAPM עם בטא ענפית בגבולות');
ok(I.val.ke === Math.max(0.10, I.val.capm), 'שיעור ההיוון = לפחות 10% (הרף של באפט), CAPM לעיון');
ok(I.val.tg === 0.03, 'צמיחה סופית = הנמוך מבין 3% לריבית');
const base = A.dcf(I.val);
ok(base.ps > 0 && base.tvShare > 0 && base.tvShare < 1, 'DCF מחזיר שווי חיובי');
ok(A.dcf(I.val, { ke: I.val.ke + 0.01 }).ps < base.ps && A.dcf(I.val, { gs: 1.2 }).ps > base.ps, 'שווי יורד עם מחיר ההון ועולה עם הצמיחה');
const sc = A.scenarios(I.val);
ok(sc.bear.ps < sc.base.ps && sc.base.ps < sc.bull.ps, 'פסימי < בסיס < אופטימי');
const rg = A.reverseG(I.val, co.price);
ok(rg != null && Math.abs(A.dcf(I.val, { g1: rg, g2: rg, gs: 1 }).ps / co.price - 1) < 1e-6, 'DCF הפוך: הצמיחה שמחזירה בדיוק את המחיר');
ok(A.reverseG(I.val, 1e9) === null && A.reverseG(I.val, 1) === null, 'מחיר שאי אפשר להסביר (גבוה או נמוך מדי) — בלי מספר');
const mm = A.multModel(co, I.val, 'mid');
ok(mm && mm.year === 2030 && mm.tgt > 0 && mm.eps5 > A.ctx(co, A.periodList(co, 'fy').pop()).eps, 'יעד רווח × מכפיל לסוף שנה 5');
const lossCo = A.prep({ ...D, A: { ...A0, eps: A0.eps.map(() => -1) }, Q: { ...Q, eps: Q.eps.map(() => -1) } }, null, 3.7);
ok(A.multModel(lossCo, A.autoInputs(lossCo, MAC).val, 'mid') === null, 'הפסד — בלי יעד לפי מכפיל');
const u = A.uncertainty(co);
ok(u.band[0] < 1 && u.band[1] > 1 && u.lv >= 0 && u.lv <= 3, 'רצועת אי־ודאות');

/* ---------- בדיקות הבריאות ---------- */
const C = A.checks(co, MAC);
ok(C.value.chk.length === 5 && ['growth', 'profit', 'safe'].every((k) => C[k].chk.length === 6), '4 קבוצות: שווי 5 (בלי "מתחת לשווי ההוגן" — דעה), השאר 6');
ok(C.growth.chk[0].pass === true && C.profit.chk[5].pass === true, 'צמיחה של 10% בשנה ותזרים חיובי בכל השנים — עוברות');
const pf = A.piotroski(co);
ok(pf && pf.list.length === 9 && pf.f >= 0 && pf.f <= 9, 'Piotroski — 9 בדיקות');
ok(A.altman(co) && A.altman(co).z > 0, 'Altman Z״');

/* ---------- השוואה ---------- */
const P = (sym, industry, sector) => ({ sym, industry, sector });
const me = P('ME', 'Internet', 'Comm');
let pk = A.pickPeers(me, [P('A', 'Retail', 'Cyc'), P('B', 'Ent', 'Comm'), P('C', 'Internet', 'Comm'), P('D', 'Bank', 'Fin')], []);
ok(pk.list.map((x) => x.sym).join() === 'C,B' && !pk.loose, 'עמיתים: אותו ענף ואז אותו סקטור; בלי סקטור אחר');
pk = A.pickPeers(me, [P('A', 'Retail', 'Cyc'), P('D', 'Bank', 'Fin')], ['D']);
ok(pk.list.map((x) => x.sym).join() === 'D' && pk.loose, 'מה שהמשתמש הוסיף — תמיד, גם מסקטור אחר; מעט עמיתים = הצעה להוסיף');
ok(A.pickPeers(me, [], []).list.length === 0, 'בלי מועמדים — רשימה ריקה');
ok(A.pickPeers(me, 'CDEFGH'.split('').map((x) => P(x, 'Internet', 'Comm')), []).list.length === 4, 'עד 4 עמיתים');
const pr = A.peerRow(co);
ok(pr.sym === 'SYN' && !('q' in pr) && Math.abs(pr.om - 0.25) < 0.01 && pr.pe > 0, 'שורת השוואה: נתונים בלבד (בלי ציון איכות), שוליים ומכפיל');

/* ---------- עיצוב מספרים ---------- */
ok(A.fmt(-1234e6, 'money', co) === '⁦−$1.23B⁩', 'סכום שלילי — מינוס אמיתי ובידוד כיוון');
ok(A.fmt(0.1234, 'pct') === '⁦12.3%⁩' && A.sgn(-0.05) === '⁦−5.0%⁩', 'אחוזים');
ok(A.fmt(5, 'ps', { cur: 'ILS' }) === '⁦₪5.00⁩', 'מטבע הדוחות');

/* ---------- מחרוזות ---------- */
const keys = new Set((src.match(/T\('(an[A-Za-z0-9]+)'/g) || []).map((x) => x.slice(3, -1)));
for (const m of src.matchAll(/\b(?:n|q|c)?:\s*'(an[A-Z][A-Za-z0-9]+)'/g)) keys.add(m[1]);
for (const m of src.matchAll(/\['(an[A-Z][A-Za-z0-9]+)'/g)) keys.add(m[1]);
const sbx = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], createElement: () => ({ classList: { add() {} }, style: {}, addEventListener() {}, setAttribute() {} }), documentElement: {} }, window: {}, navigator: {}, location: {}, setTimeout, clearTimeout, console };
vm.createContext(sbx);
vm.runInContext(app + '\n;globalThis.__S = STRINGS;', sbx);
const missing = [...keys].filter((k) => !(k in sbx.__S.he) || !(k in sbx.__S.en));
ok(keys.size > 250 && missing.length === 0, 'כל מחרוזת של המנתח קיימת בעברית ובאנגלית (' + keys.size + ')' + (missing.length ? ': ' + missing.join(',') : ''));
ok(!/[֐-׿]/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')), 'אין עברית קשיחה בקוד (רק בהערות)');


/* ---------- שכבה 6: מאיפה כל מספר ---------- */
{
  const co = { flags: [{ k: 'bal', p: '2024-12-31' }, { k: 'face', m: 'rev', p: '2023-12-31', f: 1, v: 2 }, { k: 'fix', m: 'sh', p: '2022-12-31' }, { k: 'ffill', m: 'cogs', p: '2021-12-31', f: 5, v: null }, { k: 'ffix', m: 'eps', p: '2020-12-31', f: 1.16, v: 1.13 }], tags: { capex: 'A+B', gp: 'GrossProfit' } };
  const fy = (end) => ({ kind: 'fy', end });
  ok(A.flagsAt(co, ['ta', 'tl'], fy('2024-12-31')) && A.flagsAt(co, ['eq'], fy('2024-12-31')) && !A.flagsAt(co, ['rev'], fy('2024-12-31')), 'מאזן שלא מתאזן — מסומן בגרפי הנכסים, ההתחייבויות וההון בלבד');
  ok(A.flagsAt(co, ['rev'], fy('2023-12-31')) && A.flagsAt(co, ['gm'], fy('2023-12-31')) && !A.flagsAt(co, ['ni'], fy('2023-12-31')), 'הכנסות שלא תואמות לדוח — מסומנות בהכנסות ובשולי הרווח, לא ברווח הנקי');
  ok(!A.flagsAt(co, ['sh'], fy('2022-12-31')) && !A.flagsAt(co, ['rev'], { kind: 'q', end: '2023-12-31' }), 'תיקון אוטומטי לא מסומן כ"לא אומת"; רבעון — לא');
  ok(!A.flagsAt(co, ['cogs', 'gm'], fy('2021-12-31')) && !A.flagsAt(co, ['eps'], fy('2020-12-31')), 'ערך שהושלם / הוחלף מהדוח השנתי — לא מסומן כ"לא אומת"');
  ok(A.srcDef(co, 'gp') === null && A.srcDef({ tags: {} }, 'gp') === 'anDefGp' && A.srcDef(co, 'capexN') === 'anDefCapex' && A.srcDef(co, 'debt') === 'anDefDebt' && A.srcDef(co, 'rev') === null, 'הגדרה רק למה שמחושב (רווח גולמי בלי שורה, חוב, השקעות הוניות מכמה שורות)');
  const ks = Object.keys(A.RAWK), mk = src.match(/^const M = \{[\s\S]*?^\};/m)[0];
  ok(['rev', 'gp', 'op', 'ni', 'eps', 'sh', 'cashT', 'debt', 'eq', 'ta', 'tl', 'ocf', 'fcf', 'fcfsbc', 'sbcN', 'capexN', 'buy', 'dps', 'gm', 'om', 'nm', 'cr', 'de', 'roic', 'roe', 'r40'].every((k) => ks.includes(k) && mk.includes(k + ':')), 'לכל מדד בדוחות — שדות המקור');
  ok(A.rawName('cogs') === 'anKCogs' && A.rawName('rev') === 'anMRev' && A.rawName('zzz') === 'anKOther', 'שם לשדה גולמי (לא מפתח פנימי במסך)');
  ok(/srcBlock\(co, def\.s\),/.test(src) && /co\.src === 'sec' && f\)/.test(src) && /\/\^https:\\\/\\\/www\\\.sec\\\.gov\\\/\/\.test\(f\.url/.test(src) && /rel: 'noopener noreferrer'/.test(src), 'בגיליון הגרף: המקור, קישור רק ל־sec.gov (בלשונית חדשה)');
  // 26/10/2026 (בקשת המשתמש): אי־התאמה לא מוצגת למשתמש — נאספת אצלנו (השרתון → הבקרה הלילית) ומתוקנת בקוד
  ok(!/an-flagc|anFlagTip|anSrcFlag|flagSheet|an-flagrow/.test(src), 'אי־התאמה בבדיקות — בלי הודעה ובלי סימון במסך');
  // 26/10/2026 (בקשת המשתמש): "חזור" לא יוצא מכל לשונית ישר ל־Invest, והמעברים והגלילה בלי קפיצות
  ok(/function tabLevel\(\)/.test(src) && /commit: \(\) => tabLevel\(\)/.test(src) && /navTab\('snap'\)/.test(src), 'לשונית שאינה "תמונה" = רמה בהיסטוריה — "חזור" ממנה = "תמונה"');
  ok(/function unwind\(recs\)/.test(src) && /if \(!fromPop\) unwind\(recs\)/.test(src) && /E\.back\(n\)/.test(src), 'סגירת המסך מכמה רמות — "חזור" אחד של כל הרשומות (בלי רשומות יתומות)');
  ok(/back: \(n\) => navBack\(-n\)/.test(fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8')), 'Invest מעביר למודול back — navBack (נבלע ב־_navSkipPop)');
  ok(/wrap\.append\(header\(co\), tabsBar\(\)\)/.test(src) && /min\(ROOT\.scrollTop, stickY\(\)\)/.test(src) && /hold: holdY, holdOn: holdOn\(prev, to\)/.test(src), 'הלשוניות דבוקות לאורך כל העמוד; במעבר — הגלילה נשמרת עד הנקודה שבה הן נדבקות, והראש לא מסתובב');
  ok(/an-vtbl/.test(src) && !/tbl\.scrollLeft/.test(src), 'טבלה לאורך — שורה לכל תקופה, בלי גלילה הצידה');
  ok(/an-still', S\.seen\.size > 0\)/.test(src) && /function settle\(\)/.test(src) && /\.an-still \.an-draw/.test(fs.readFileSync(path.join(__dirname, '..', 'analysis.css'), 'utf8')), 'תנועת כניסה רק בעמוד הראשון; כרטיס מתחת למסך ואחרי 2 שניות — במצב הסופי');
  ok(/function emptyOf\(def, series\)/.test(src) && /anNoDiv/.test(src) && /emptyBlock\(e0\)/.test(src), 'מדד בלי ערכים — מצב שקט ומוסבר ("לא מחלקת דיבידנד"), לא גרף ריק');
}
/* ---------- שילוב ואבטחה ---------- */
ok(!/\bfetch\(|localStorage|sessionStorage|indexedDB|innerHTML\s*=\s*[^'"]*\+/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')), 'המודול לא פונה לרשת ולא שומר בטלפון — הכל דרך env');
ok(/import\('\.\/analysis\.js'\)\.then\(\(m\) => m\.openAnalysis\(sym, analysisEnv\(\)\)\)/.test(app), 'נטען רק בלחיצה (import דינמי)');
ok(/classList\.contains\('an-open'\)\) return false;/.test(app), 'לולאת המחירים עוצרת כשהמנתח פתוח');
ok(/'\.\/analysis\.js', '\.\/analysis\.css'/.test(sw), 'במעטפת של sw.js (אותה גרסה של app.js)');
ok(/E\.modalPush\(\(\) => closeAnalysis\(true\)\)/.test(src) && /E\.modalPush\(\(\) => closeSheet\(true\)\)/.test(src), '"חזור" סוגר גיליון ואז את המסך (modalPush)');
ok(/op: 'fund', sym/.test(src) && /op: 'macro'/.test(src), 'הנתונים מהשרתון: op fund + macro');
ok(/document\.addEventListener\('pointerdown', off, true\)/.test(src) && /!tip\._svg\.contains\(e\.target\)\) tip\._hide\(\)/.test(src) && /i === cur/.test(src), 'בועת הגרף נסגרת בנגיעה מחוץ לגרף ובנגיעה חוזרת באותה עמודה');
const sels = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/(^|\})\s*([^{}@]+)\{/g) || [];
const bad = sels.map((s) => s.replace(/^\}?\s*/, '').replace(/\{$/, '').trim()).filter((s) => s && !/^(from|to|\d)/.test(s) && !s.split(',').every((p) => /\.an-|an-open|\.an\b/.test(p)));
ok(bad.length === 0, 'כל סלקטור בעיצוב בתחום an-' + (bad.length ? ': ' + bad.join(' | ') : ''));
ok(/z-index: 900/.test(css) && /\.an-sheet \{[^}]*z-index: 941/.test(css), 'שכבה מעל האפליקציה, גיליון מעליה');

/* ---------- הצגה מחדש (26/10/2026, AppLovin): צמיחה מול השנה הקודמת באותו דוח ---------- */
{
  // 2023–2025 הוצגו מחדש בלי עסק שנמכר (60% מההכנסות); 2020–2022 כפי שדווחו. היחס מהדוח: ‎+10% כל שנה
  const cut = (a, from) => a.map((x, i) => (i >= from && x != null ? x * 0.6 : x));
  const R = { ...D, A: { ...A0, rev: cut(A0.rev, 3) }, Q: { ...Q, rev: cut(Q.rev, 12) },
    C: { A: { rev: [null, null, null, 1.1, null, null] }, Q: { rev: Q.rev.map((_, j) => (j >= 12 && j < 16 ? 1.1 : null)) } } };
  const c = A.prep(R, null, 3.7), fyp = A.periodList(c, 'fy');
  const g = fyp.map((p) => A.growthOf(c, p, 'rev'));
  ok(Math.abs(g[3] - 0.1) < 1e-9, 'שנה שהוצגה מחדש: צמיחה מול השנה הקודמת באותו דוח (+10%, לא −34%)');
  ok(Math.abs(g[4] - (146 / 133 - 1)) < 1e-9 && Math.abs(g[2] - 0.1) < 1e-9, 'שנים אחרות — מהסדרה כרגיל');
  ok(Math.abs(A.cagrN(c, 'rev', 5)[0] - Math.pow(1.1 * 146 / 133 * 161 / 146 * 1.1 * 1.1, 1 / 5) + 1) < 1e-9, 'צמיחה ממוצעת על פני הצגה מחדש — מכפלת הצמיחות שנה אחר שנה (לא 2025 החדש מול 2020 הישן)');
  ok(Math.abs(A.cagrN(co, 'rev', 5)[0] - A.cagrN({ ...co, C: null }, 'rev', 5)[0]) < 1e-12, 'בלי הצגה מחדש — אותה צמיחה ממוצעת כמו תמיד');
  ok(A.restated(c, ['rev']).join() === '3' && !A.restated(co, ['rev']).length, 'השנים שהוצגו מחדש — להערה בגיליון');
  const qp = A.periodList(c, 'q'), q2 = qp.find((p) => p.end === '2023-06-30');
  ok(Math.abs(A.growthOf(c, q2, 'rev') - 0.1) < 1e-9, 'רבעון שהוצג מחדש — מול הרבעון המקביל באותו דוח');
  const R0 = { ...R, C: { A: {}, Q: { rev: Q.rev.map((_, j) => (j === 13 ? 0 : null)) } } }, c0 = A.prep(R0, null, 3.7);
  ok(A.growthOf(c0, A.periodList(c0, 'q').find((p) => p.end === '2023-06-30'), 'rev') === null, 'רבעון על בסיס אחר שאין איך להשוות (0) — בלי צמיחה, לא צמיחה שגויה');
  ok(/anRestated: 'מ־\{y\}/.test(app) && /anRestated: 'From \{y\}/.test(app) && /restNote\(co, def\.s\)/.test(src), 'הערה בגיליון כשהגרף כולל שנה שהוצגה מחדש — בשתי השפות');
}

/* ---------- 12 החודשים האחרונים: רבעונים רצופים, וסוף שנה = המספר השנתי (26/10/2026) ---------- */
{
  // רבעון שחסר ברשימה (2025-06-30) — ארבע נקודות סמוכות הן 15 חודשים, לא 12
  const drop = (a, j) => a.filter((_, i) => i !== j), jx = q.indexOf('2025-06-30');
  const G = { ...D, q: drop(q, jx), Q: Object.fromEntries(Object.keys(Q).map((k) => [k, drop(Q[k], jx)])) };
  const c = A.prep(G, null, 3.7), last = c.q.length - 1;
  ok(!A.qRun(c, last - 3, last) && A.qRun(co, co.q.length - 4, co.q.length - 1), 'רבעון חסר ברשימה = לא רצף של 12 חודשים');
  // שנה של 52/53 שבועות (16/11/2026, בדיקת העומק): רבעון של 16 או 17 שבועות (Kroger — הראשון, Costco/PepsiCo — הרביעי) הוא
  // רבעון, לא חור; חצי שנה (‏~182 יום) — עדיין חור
  const wk = { q: ['2024-05-25', '2024-08-17', '2024-11-09', '2025-02-01', '2025-05-24', '2025-08-16', '2025-11-08', '2026-02-28'] };
  ok(A.qRun(wk, 0, 3) && A.qRun(wk, 4, 7) && A.qRun(wk, 1, 4), 'רבעון של 16/17 שבועות (111/119 יום) — רצף');
  ok(!A.qRun({ q: ['2024-03-31', '2024-09-30', '2024-12-31', '2025-03-31'] }, 0, 3), 'פער של חצי שנה — עדיין לא רצף');
  // תווית הרבעון: שנה של 52/53 שבועות שנגמרת ב־1 בינואר — רבעון 4 של השנה הקודמת, לא תווית כפולה
  const lb = A.periodList({ q: ['2022-10-02', '2023-01-01', '2023-04-02', '2023-07-02', '2023-10-01', '2023-12-31'] }, 'q').map((p) => p.label);
  ok(lb.join(' ') === 'Q3·22 Q4·22 Q1·23 Q2·23 Q3·23 Q4·23' && new Set(lb).size === lb.length, 'תווית רבעון לפי הסוף פחות 14 יום — בלי כפילות');
  const pt = A.periodList(c, 'fy').pop(), tt = { kind: 'ttm', i: last, end: c.q[last] };
  ok(!A.hasTTM(c) && pt.kind === 'fy' && A.ctx(c, pt).rev === rev[5], 'ארבעת הרבעונים האחרונים לא רצופים — "עכשיו" = השנה האחרונה (לא מסך ריק)');
  ok(A.raw(c, 'rev', tt) === null && A.raw(c, 'debt', tt) === 20e9, 'TTM עם רבעון חסר — בלי סכום מומצא (מאזן — הרבעון האחרון כרגיל)');
  const q3 = A.periodList(c, 'q').find((p) => p.end === '2025-09-30');
  ok(A.growthOf(c, q3, 'rev') !== null && Math.abs(A.growthOf(c, q3, 'rev') - (161 / 146 - 1)) < 1e-9, 'רבעון מול המקביל לו — לפי התאריך, גם כשחסר רבעון ביניהם');
  const q1 = A.periodList(c, 'q').find((p) => p.end === '2026-03-31');
  ok(A.raw(c, 'rev', q1, 1) === rev[5] / 4 && A.qBack(c, last, 1) === last - 3, 'שנה קודם = הרבעון שהסתיים שנה לפני (3 מקומות אחורה כשחסר רבעון), לא 4 מקומות אחורה');
  ok(A.qBack(c, 2, 1) === -1, 'אין רבעון שנה קודם — בלי השוואה');
  ok(!A.ttmPoints(c, 'rev').some(([e]) => e === '2025-09-30' || e === '2026-03-31'), 'היסטוריית המכפילים — בלי נקודה שנשענת על חור');
  // סוף שנה: הרווח למניה השנתי מהדוח, לא סכום ארבעת הרבעונים (רווח למניה לא מצטבר)
  const E = { ...D, Q: { ...Q, eps: Q.eps.map((x, j) => (q[j] === '2024-12-31' ? x + 1 : x)) } }, ce = A.prep(E, null, 3.7);
  const sp = A.ttmPoints(co, 'sh').filter(([e]) => e === '2024-12-31');
  ok(sp.length === 1, 'מספר מניות בסוף שנה — נקודה אחת (של הרבעון)');
  const at = A.ttmPoints(ce, 'eps').filter(([e]) => e === '2024-12-31');
  ok(at.length === 1 && Math.abs(at[0][1] - A0.eps[4]) < 1e-9, 'סוף שנה בהיסטוריה = נקודה אחת, הרווח למניה מהדוח השנתי');
}

// מניה שלא נסחרת — שורה מתחת לראש, לא נתונים ישנים בשקט
ok(/co\.gone \? h\('p', \{ class: 'an-gone' \}, T\('anGone'/.test(src), 'מניה שלא נסחרת — שורה בראש המסך');
/* ---------- מחיר לבדיקה (18/11/2026, בקשת המשתמש): המחיר הערוך מזיז את מה שנמדד מול המחיר, ההנחות והשווי — לא ---------- */
{
  const e = A.indFix(A.prep(D, null, 3.7), MAC);
  const pe0 = A.checks(e, MAC).value.chk[0].v, H0 = A.multHist(e), now0 = H0.pe[H0.pe.length - 1];
  const D0 = A.calcDefaults(e), F0 = JSON.stringify(A.fairOf(e, MAC)), ke0 = A.autoInputs(e, MAC).val.ke, pr0 = A.peerRow(e);
  A.setPx(e, 200);
  ok(e.pxEd && e.price === 200 && e.price0 === 400, 'מחיר לבדיקה: המחיר החדש, והאמיתי נשמר');
  ok(Math.abs(e.fpe - 9) < 1e-9 && e.fpe0 === 18, 'המכפיל הצפוי זז ביחס ישר למחיר');
  const H1 = A.multHist(e);
  ok(Math.abs(H1.pe[H1.pe.length - 1] - now0 / 2) < 1e-9, 'נקודת "היום" בהיסטוריית המכפילים — לפי המחיר הערוך (המטמון מתאפס)');
  ok(H1.pe.slice(0, -1).join() === H0.pe.slice(0, -1).join(), 'ההיסטוריה עצמה לא זזה');
  const pr1 = A.peerRow(e);
  ok(Math.abs(pr1.pe - pr0.pe / 2) < 1e-9 && Math.abs(pr1.fy - pr0.fy * 2) < 1e-9 && Math.abs(pr1.fpe - pr0.fpe / 2) < 1e-9, 'ההשוואה: מכפיל, מכפיל צפוי ותשואת תזרים לפי המחיר הערוך');
  ok(JSON.stringify(A.calcDefaults(e).val) === JSON.stringify(D0.val), 'הערכים המוצעים במחשבון — לפי המחיר האמיתי');
  ok(A.autoInputs(e, MAC).val.ke === ke0 && JSON.stringify(A.fairOf(e, MAC)) === F0, 'מחיר ההון והשווי — לא תלויים במחיר לבדיקה');
  const C1 = A.checks(e, MAC).value.chk;
  ok(C1.every((x) => x.d) && C1[0].v !== pe0, 'בדיקות התמחור — מסומנות כתלויות במחיר ומחושבות מחדש');
  ok(A.pxReal(e) === 400 && A.real(e).price === 400 && A.real(e) === A.real(e) && A.real(e).fpe === 18, 'real — עותק אחד במחיר האמיתי');
  A.setPx(e, null);
  ok(!e.pxEd && e.price === 400 && e.fpe === 18 && A.real(e) === e, 'החזר — הכל חוזר לאמיתי');
  A.setPx(e, 400);
  ok(!e.pxEd, 'מחיר שווה לאמיתי = לא ערוך');
  // התשואה הרצויה במחשבון → המחיר: "המחיר לתשואה של X" בתרחיש הבסיס נותן בדיוק X (וגם עם דיבידנדים)
  for (const dv of [0, 0.4]) {
    const V = { ...D0.val, dv, req: 0.15 }, p = A.calcRun(V, D0.shares, 1)[1].buy;
    ok(p > 0 && Math.abs(A.calcRun(V, D0.shares, p)[1].ret - 0.15) < 1e-6, 'מחיר לתשואה רצויה של 15% — התשואה בתרחיש הבסיס יוצאת 15%' + (dv ? ' (עם דיבידנד)' : ''));
  }
  ok(A.prep(D, null, 3.7).price === 400 && !('price0' in D), 'כל כניסה לניתוח בונה מחדש מהתשובה — המחיר האמיתי');
}
{
  const s = src, g = fs.readFileSync(path.join(root, 'glass-btn.css'), 'utf8');
  ok(/S\.cv = \{\}; S\.px = null; S\.reqEd = null;/.test(s) && /S\.px = null; S\.reqEd = null; S\.pxHook = null;[^\n]*\n\s*const r = ROOT; ROOT = null/.test(s), 'כל כניסה ויציאה מהניתוח מאפסות את המחיר לבדיקה');
  ok((s.match(/'data-dep'/g) || []).length >= 9, 'ערכים שנגזרים מהמחיר מסומנים (data-dep)');
  ok(/function edRow\(co\)[\s\S]{0,900}pxReset/.test(s) && /edRow\(co\),\s*\n\s*h\('div', \{ class: 'an-hero' \}/.test(s), 'שורת "מה שונה" עם "החזר" בראש העמוד הראשי');
  ok(/if \(S\.co && S\.px && S\.px\.k === 'ret'\) setPx\(S\.co, retPx\(S\.co\)\)/.test(s), 'המחיר לפי התשואה הרצויה מחושב לפני הציור');
  ok(/\.an-pxed\b/.test(g) && /\.an-edrow-b\b/.test(g) && /\.an-pxed\.on, \.an-edrow-b\) \{ --gb-force/.test(g), 'הכפתורים החדשים בזכוכית (כתומה כשפעיל)');
  for (const k of ['anPxEdit', 'anPxT', 'anPxEx', 'anPxApply', 'anPxErr', 'anPxReal', 'anPxWas', 'anPxRowT', 'anPxRowR', 'anPxRowS', 'anPxBack', 'anCReqPx'])
    ok((app.match(new RegExp('\\n  ' + k + ': ', 'g')) || []).length === 2, 'מחרוזת בשתי השפות: ' + k);
  ok(/\[data-dep\]::before/.test(css) && /--an-ed-fill:/.test(css), 'הנקודה הכתומה והצבעים בבהיר ובכהה');
}

/* ---------- עריכת נתון שנגזר מהמחיר (18/11/2026, בקשת המשתמש): כל נתון → מחיר → כל השאר ---------- */
{
  const e = A.indFix(A.prep(D, null, 3.7), MAC), K = ['mcap', 'pe', 'fpe', 'fy', 'pfcf', 'ps', 'evebit', 'pb', 'pffo'];
  ok(K.every((k) => A.metNow(e, k) > 0 && A.canEdM(e, k)), 'עריכת נתונים: כל הנתונים שנגזרים מהמחיר זמינים בנתוני הבדיקה');
  ok(K.every((k) => Math.abs(A.pxFrom(e, k, A.metNow(e, k)) / 400 - 1) < 1e-9), 'הערך של היום מחזיר בדיוק את המחיר האמיתי — בכל נתון');
  ok(K.every((k) => {
    const v = A.metNow(e, k) * (k === 'fy' ? 1.6 : 0.8), p = A.pxFrom(e, k, v);
    A.setPx(e, p); const back = A.metNow(e, k); A.setPx(e, null);
    return Math.abs(back / v - 1) < 1e-9 && (k === 'evebit' || k === 'fy' || Math.abs(p / 400 - 0.8) < 1e-9);
  }), 'שינוי נתון → מחיר → אותו נתון בדיוק (מכפילים ביחס ישר, תשואת מזומן הפוך, שווי העסק — עם החוב והמזומן)');
  {
    const v = A.metNow(e, 'fy') * 2;
    ok(Math.abs(A.pxFrom(e, 'fy', v) - 200) < 1e-9, 'תשואת מזומן כפולה = חצי מחיר');
  }
  A.setPx(e, 200);
  ok(Math.abs(A.pxFrom(e, 'fpe', 18) - 400) < 1e-9 && Math.abs(A.pxFrom(e, 'pe', A.metNow(A.real(e), 'pe')) - 400) < 1e-9, 'גם כשהמחיר כבר ערוך — ההיפוך לפי הנתונים עצמם (המכפיל הצפוי לפי האמיתי)');
  A.setPx(e, null);
  ok(A.MED.pe.inv(20, { eps: -1 }) === null && A.MED.fy.inv(0.05, { fcf: -5 }, 1) === null && A.MED.evebit.inv(10, { op: 0 }, 1) === null && A.MED.ps.inv(2, { rev: 0 }, 1) === null,
    'רווח/תזרים/מכירות לא חיוביים — אין מחיר, ולכן אין עיפרון');
  ok(A.MED.evebit.inv(1, { op: 10, debt: 100, cashT: 0 }, 1) < 0 && /return p > 0 && isFinite\(p\) \? p : null;\n\}\nconst canEdM/.test(src), 'מכפיל שווי העסק נמוך מהחוב נטו — מחיר שלילי נדחה');
  ok(!A.canEdM({ ...e, fxMix: true }, 'pe') && A.pxFrom(e, 'pe', 0) === null && A.pxFrom(e, 'nc', 5) === null, 'מטבעות מעורבים, אפס או נתון שלא תלוי במחיר — לא עורכים');
  const tm = A.medTxt(e, 'mcap', 3.2e11), tf = A.medTxt(e, 'fy', 0.045);
  ok(tm.join('|') === '320.00|$|B' && Math.abs(A.medVal(e, 'mcap', '320') - 3.2e11) < 1 && Math.abs(A.medVal(e, 'mcap', '1,250.5') - 1.2505e12) < 1, 'שווי שוק נערך בסולם של האריח (B), עם פסיקים');
  ok(tf.join('|') === '4.5||%' && Math.abs(A.medVal(e, 'fy', '4.5') - 0.045) < 1e-12 && A.medTxt(e, 'pe', 25).join('|') === '25.0||×' && A.medVal(e, 'pe', '-3') === 3 && A.medVal(e, 'pe', 'x') === null,
    'תשואת מזומן באחוזים, מכפיל ב־×, טקסט לא מספרי נדחה');
  const H = A.medHist(e, 'ps');
  ok(H && H.lo <= H.avg && H.avg <= H.hi && H.n === 10 && A.medHist(e, 'mcap') === null && A.medHist(e, 'fy') === null, 'קיצורי ההיסטוריה — רק למכפילים, במחיר האמיתי');
  A.setPx(e, 200);
  ok(JSON.stringify(A.medHist(e, 'ps')) === JSON.stringify(H), 'הקיצורים לא זזים עם המחיר הערוך');
  A.setPx(e, null);
  // החיבור בממשק
  ok(/const DEP = \(k\) => \(S\.co && S\.co\.pxEd \? \(k && S\.px && S\.px\.k === 'm' && S\.px\.key === k \? 'ed' : ''\) : null\);/.test(src), 'DEP(k) — הנתון שנערך מסומן "ed" (כתום מודגש), השאר בנקודה');
  ok(/'data-dep': DEP\(k\) \}, fmt\(now, 'x', co, 1\), ce \? penI\(\) : null/.test(src) && /PX_CMP\.has\(k\) \? DEP\(k\)/.test(src) && /PX_FACT\.has\(key\) \? DEP\(key\)/.test(src), 'האריחים, כרטיס המכפילים וההשוואה — מסמנים את הנתון שנערך');
  ok(/S\.reqEd = null; setPx\(co, p\); S\.px = co\.pxEd \? \{ k: 'm', key, v \} : null;/.test(src), 'החל: מחיר מהנתון, ונתון ערוך אחד בכל רגע (מחליף מחיר/תשואה)');
  ok(/if \(MED\[key\]\) medForm\(b, key, rec\)/.test(src) && /role: 'button', tabindex: '0', on: \{ click: go, keydown/.test(src), 'הגיליון של האריח וכל שורת מכפיל — פותחים את טופס העריכה (גם במקלדת)');
  ok(/m \? T\('anMRowT'/.test(src) && /m \? T\('anMRowS'/.test(src), 'השורה למעלה אומרת איזה נתון שונה');
  ok(['anMRowT', 'anMRowS', 'anMWill', 'anMWas', 'anMNow', 'anMLo', 'anMHi', 'anMYrs', 'anMReal', 'anMErr'].every((k) => (app.match(new RegExp('\\b' + k + ':', 'g')) || []).length === 2), 'מחרוזות העריכה — בעברית ובאנגלית');
  ok(/\.an-root \[data-dep="ed"\]::before \{ content: none; \}/.test(css) && /\.an-mchip \{/.test(css) && /\.an-sheet\.small\.tall \{ max-height: 88vh; \}/.test(css), 'עיצוב: הנתון שנערך בלי נקודה, קיצורים, גיליון גבוה לטופס');
  ok(/an-grab an-mchip/.test(fs.readFileSync(path.join(root, 'glass-btn.css'), 'utf8')), 'הקיצורים — ברשימת הפטורים של כפתורי הזכוכית');
}
console.log('\nכל בדיקות מנתח החברות עברו: ' + n);

/* ---------- מחשבון השווי (27/10/2026, לפי ת־ניתוח) ---------- */
{
  const V = { base: 100e9, g: 0.1, m: 0.2, yrs: 5, sh: 0, lo: 15, mid: 20, hi: 25, req: 0.1 };
  const R = A.calcRun(V, 1e9, 400);
  const rev = 100e9 * 1.1 ** 5;
  ok(Math.abs(R[1].rev - rev) < 1 && Math.abs(R[1].prof - rev * 0.2) < 1 && Math.abs(R[1].mcap - rev * 0.2 * 20) < 10, 'הכנסות × (1+צמיחה)^שנים × שולי רווח × מכפיל = שווי (לפי ת־ניתוח)');
  ok(Math.abs(R[1].ps - R[1].mcap / 1e9) < 1e-6 && Math.abs(R[1].ret - ((R[1].ps / 400) ** 0.2 - 1)) < 1e-12, 'מחיר = שווי ÷ מניות; תשואה שנתית מהמחיר של היום');
  ok(Math.abs(R[1].buy - R[1].ps / 1.1 ** 5) < 1e-9, 'מחיר היום לתשואה רצויה = מחיר עתידי ÷ (1+תשואה)^שנים');
  const Rb = A.calcRun({ ...V, sh: -0.03 }, 1e9, 400);
  ok(Rb[1].ps > R[1].ps && Math.abs(Rb[1].ps - R[1].mcap / (1e9 * 0.97 ** 5)) < 1e-6, 'רכישות חוזרות — פחות מניות, מחיר גבוה יותר');
  ok(R[0].ps < R[1].ps && R[1].ps < R[2].ps, 'נמוך < בסיס < גבוה');
  const D0 = A.calcDefaults(co);
  ok(D0.basis === 'ni' && D0.val.g <= 0.15 && D0.val.g >= -0.05 && D0.val.yrs === 5 && D0.val.req === 0.1, 'ערכים מוצעים: צמיחה עד 15%, 5 שנים, תשואה רצויה 10%');
  ok(D0.val.lo <= D0.val.mid && D0.val.mid <= D0.val.hi && D0.val.hi <= 40, 'מכפילים מוצעים בסדר עולה, עד ×40');
  ok(A.calcDefaults(co, 'fcf').basis === 'fcf' && A.calcDefaults(co, 'fcf').mkey === 'pofcf', 'לפי תזרים לבעלים — מכפיל מחיר לתזרים לבעלים');
  // 27/10/2026: מכפילים מעל התקרה — יורדים באותו יחס (ServiceNow: כל השלושה יצאו 40); בסיס = חציון, לא ממוצע שנה חריגה מושכת
  const Mc = A.calcMults([87, 90, 100, 115, 120, 140, 153, 160]);
  ok(Mc.m[0] < Mc.m[1] && Mc.m[1] < Mc.m[2] && Mc.m[2] === 40 && Mc.k < 1, 'היסטוריה מעל ×40 — שלושה מכפילים שונים, הגבוה 40');
  ok(Math.abs(Mc.m[0] / Mc.m[2] - Mc.raw[0] / Mc.raw[2]) < 0.13, 'היחס בין הנמוך לגבוה נשמר (עד עיגול ל־5)');
  const Mo = A.calcMults([25, 26, 27, 28, 29, 30, 31, 32, 33, 120]); // ממוצע 38 — מעל הרבע העליון
  ok(Mo.k === 1 && Mo.m.join() === '25,30,35', 'שנה חריגה לא מעבירה את הבסיס מעל הגבוה (חציון)');
  ok(A.calcMults([10, 12, 14, 16]).k === 1, 'מתחת לתקרה — ההיסטוריה כמו שהיא');
  ok([Mc, Mo, A.calcMults([25.5, 27, 28, 29, 31.5]), A.calcMults([3, 3, 3])].every((x) => x.m.every((v) => v % 5 === 0) && x.m[0] < x.m[1] && x.m[1] < x.m[2]), 'מכפילים בכפולות של 5, שלושה שונים');
  ok(A.calcMults([25.5, 27, 28, 29, 31.5]).m.join() === '25,30,35', 'עיגול שאיחד שניים — נפרדים שוב (25/30/35)');
  // דיבידנדים בתשואה: מחיר 100, מחיר בסוף 100, דיבידנד 5 בשנה = 5% בשנה
  const Rd = A.calcRun({ base: 100, g: 0, m: 1, yrs: 5, sh: 0, dv: 1, lo: 20, mid: 20, hi: 20, req: 0.05 }, 20, 100);
  ok(Math.abs(Rd[1].ret - 0.05) < 1e-6 && Math.abs(Rd[1].divs - 25) < 1e-9 && Math.abs(Rd[1].buy - 100) < 1e-6, 'דיבידנד נכנס לתשואה ולמחיר היום (תשואה פנימית)');
  ok(A.calcRun({ ...V, dv: 0 }, 1e9, 400)[1].ret === R[1].ret || Math.abs(A.calcRun({ ...V, dv: 0 }, 1e9, 400)[1].ret - R[1].ret) < 1e-9, 'בלי דיבידנד — כמו קודם');
  ok(A.calcDefaults({ ...co, fin: true, _mh: null }, 'fcf').basis === 'ni', 'בנק — רק לפי רווח נקי');
  const src = fs.readFileSync(path.join(__dirname, '..', 'analysis.js'), 'utf8');
  ok(!/pageValDef|fairCard\(|assumeCard\(/.test(src) && /function pageVal\(co, pg\)[\s\S]{0,200}calcDefaults/.test(src), 'עמוד השווי = המחשבון בלבד, בלי DCF ובלי פרשנות');
  ok(/DEF_NOTE = \{/.test(src) && /defNote\(def\.s\)/.test(src) && /anDnMult/.test(src), 'שורה גלויה איך מדד שמחושב בכמה דרכים מחושב אצלנו');
}
