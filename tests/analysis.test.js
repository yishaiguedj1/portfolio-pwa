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
ok(Math.abs(I.val.ke - (0.042 + I.bl * 0.042)) < 1e-12 && I.bl >= 0.8 && I.bl <= 2, 'מחיר ההון = CAPM עם בטא ענפית בגבולות');
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
ok(['value', 'growth', 'profit', 'safe'].every((k) => C[k].chk.length === 6), '4 קבוצות × 6 בדיקות');
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
ok(pr.sym === 'SYN' && pr.q >= 0 && pr.q <= 24 && Math.abs(pr.om - 0.25) < 0.01 && pr.pe > 0, 'שורת השוואה: ציון מתוך 24, שוליים ומכפיל');

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

/* ---------- שילוב ואבטחה ---------- */
ok(!/\bfetch\(|localStorage|sessionStorage|indexedDB|innerHTML\s*=\s*[^'"]*\+/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')), 'המודול לא פונה לרשת ולא שומר בטלפון — הכל דרך env');
ok(/import\('\.\/analysis\.js'\)\.then\(\(m\) => m\.openAnalysis\(sym, analysisEnv\(\)\)\)/.test(app), 'נטען רק בלחיצה (import דינמי)');
ok(/classList\.contains\('an-open'\)\) return false;/.test(app), 'לולאת המחירים עוצרת כשהמנתח פתוח');
ok(/'\.\/analysis\.js', '\.\/analysis\.css'/.test(sw), 'במעטפת של sw.js (אותה גרסה של app.js)');
ok(/E\.modalPush\(\(\) => closeAnalysis\(true\)\)/.test(src) && /E\.modalPush\(\(\) => closeSheet\(true\)\)/.test(src), '"חזור" סוגר גיליון ואז את המסך (modalPush)');
ok(/op: 'fund', sym/.test(src) && /op: 'macro'/.test(src), 'הנתונים מהשרתון: op fund + macro');
const sels = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/(^|\})\s*([^{}@]+)\{/g) || [];
const bad = sels.map((s) => s.replace(/^\}?\s*/, '').replace(/\{$/, '').trim()).filter((s) => s && !/^(from|to|\d)/.test(s) && !s.split(',').every((p) => /\.an-|an-open|\.an\b/.test(p)));
ok(bad.length === 0, 'כל סלקטור בעיצוב בתחום an-' + (bad.length ? ': ' + bad.join(' | ') : ''));
ok(/z-index: 900/.test(css) && /\.an-sheet \{[^}]*z-index: 941/.test(css), 'שכבה מעל האפליקציה, גיליון מעליה');

console.log('\nכל בדיקות מנתח החברות עברו: ' + n);
