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
ok(Math.abs(L.m - (clo.fcf - clo.sbc) / clo.rev) < 1e-9 && Math.abs(L.r40 - (L.g + L.m)) < 1e-12, 'Rule of 40 = צמיחת הכנסות + שולי תזרים לבעלים (אחרי תגמול במניות)');
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
  ok(/an-flagc/.test(src) && /T\('anFlagTip'\)/.test(src), 'ערך שלא עבר בדיקה — מסומן בטבלה ובבועה');
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

console.log('\nכל בדיקות מנתח החברות עברו: ' + n);
