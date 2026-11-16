/* התיק של ביל אקמן — הפענוח של דיווחי SEC (ibkr-proxy/lib/ackman.js), 16/11/2026.
   הקבצים ב־tests/fixtures/ackman/ הם דיווחים ציבוריים אמיתיים (מקוצרים — בלי חתימות, כתובות וקוד הגישה):
   - 13F-HR של Pershing Square Inc. לרבעון 2 2026 (הוגש 14/8/2026): 15 שורות, מתוכן 2 של חברת הניהול עצמה.
   - Form 4 על Howard Hughes (8/11/2018): מכירת 899,647 מניות ב־109.39$ ופירוק עסקת החלף.
   הרצה: node tests/ackman.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let n = 0;
const ok = (c, name) => { n++; assert(c, name); console.log('ok -', name); };
const ROOT = path.join(__dirname, '..');
const FX = (f) => fs.readFileSync(path.join(__dirname, 'fixtures/ackman', f), 'utf8');
const A = require(path.join(ROOT, 'ibkr-proxy/lib/ackman.js'));

/* ---- כלים ---- */
ok(A.isoDate('06-30-2026') === '2026-06-30' && A.isoDate('2018-11-08') === '2018-11-08' && A.isoDate('6/3/2024') === '2024-06-03' && A.isoDate('x') === '', 'תאריך: שלוש הצורות של SEC → ISO');
ok(A.unNs('<ns1:a x="1"><n1:b>v</n1:b></ns1:a>') === '<a x="1"><b>v</b></a>', 'הסרת namespace');
ok(A.decode('S&amp;P &lt;x&gt;') === 'S&P <x>' && A.decode('<![CDATA[a&b]]>') === 'a&b', 'פענוח ישויות ו־CDATA');
ok(A.valueUnit('2022-11-14') === 1000 && A.valueUnit('2023-01-03') === 1 && A.valueUnit('2026-08-14') === 1, 'יחידות השווי: אלפים לפני 3/1/2023, דולרים אחרי');

/* ---- 13F: דף השער ---- */
const P = A.parse13fPrimary(FX('13f-2026q2-primary.xml'));
ok(P.form === '13F-HR' && P.period === '2026-06-30' && !P.isAmendment && P.amendType === '', '13F: סוג, רבעון, לא תיקון');
ok(P.filer === 'PERSHING SQUARE INC.' && P.reportType === '13F HOLDINGS REPORT', '13F: המגיש (PS Inc.) וסוג הדוח');
ok(P.entryTotal === 15 && P.valueTotal === 19465692772, '13F: סה"כ שורות ושווי מדף השער');
ok(P.included.length === 6 && P.included[0].n === '1' && P.included[0].cik === '1336528', '13F: שישה מנהלים כלולים — הראשון PSCM');
ok(P.included.filter((o) => A.OWN_RE.test(o.name)).map((o) => o.n).join(',') === '5,6', '13F: שני הכלים של חברת הניהול (PSUS Holdings, HHH Holdings) מזוהים לפי השם');

/* ---- 13F: הטבלה ---- */
const T = A.parse13fTable(FX('13f-2026q2-table.xml'));
ok(T.length === 15 && T.reduce((s, r) => s + r.value, 0) === P.valueTotal, '13F: 15 שורות, הסכום שווה בדיוק לשער');
const spgi = T.find((r) => r.cusip === '78409V104');
ok(spgi && spgi.name === 'S&P GLOBAL INC' && spgi.shares === 2593155 && spgi.type === 'SH' && spgi.pc === '', '13F: שורה מלאה (S&P Global, ישות מפוענחת)');
const F = A.fundRows(T, P);
ok(F.length === 13, '13F: אחרי הוצאת חברת הניהול — 13 אחזקות של הקרנות');
ok(!F.some((r) => /PERSHING SQUARE USA/.test(r.name)) && F.filter((r) => /HOWARD HUGHES/.test(r.name)).length === 1, '13F: בלי מניות PSUS ו־9M HHH של חברת הניהול');
ok(F.find((r) => /HOWARD HUGHES/.test(r.name)).shares === 18852064, '13F: HHH של הקרנות — 18,852,064');
const fundsTotal = F.reduce((s, r) => s + r.value, 0);
ok(fundsTotal === 19465692772 - 643410000 - 149520000, '13F: שווי הקרנות = סה"כ פחות שתי השורות של חברת הניהול');

/* ---- איחוד רבעון ---- */
const base = { form: '13F-HR', filed: '2026-08-14', cik: A.CIK.psinc, acc: 'a', primary: P, rows: T };
let C = A.consolidateQuarter([base]);
ok(C.rows.length === 13 && C.rows[0].name === 'UBER TECHNOLOGIES INC' && C.rows.reduce((s, r) => s + r.value, 0) === fundsTotal, 'איחוד: דוח אחד — 13 שורות, ממוינות לפי שווי');
const extra = { cusip: '000000000', name: 'X', cls: 'COM', value: 5, shares: 1, pc: '', mgr: '1' };
C = A.consolidateQuarter([base, { form: '13F-HR/A', filed: '2026-11-14', cik: A.CIK.psinc, acc: 'b', primary: Object.assign({}, P, { isAmendment: true, amendType: 'NEW HOLDINGS' }), rows: [extra] }]);
ok(C.rows.length === 14 && C.acc.join() === 'a,b', 'איחוד: תיקון NEW HOLDINGS (אחזקה חסויה שנחשפה) מתווסף');
C = A.consolidateQuarter([{ form: '13F-HR/A', filed: '2026-11-14', cik: A.CIK.psinc, acc: 'b', primary: Object.assign({}, P, { isAmendment: true, amendType: 'RESTATEMENT' }), rows: [extra] }, base]);
ok(C.rows.length === 1 && C.rows[0].cusip === '000000000', 'איחוד: RESTATEMENT מחליף — גם כשהוא מגיע ראשון ברשימה (לפי תאריך הגשה)');
C = A.consolidateQuarter([Object.assign({}, base, { cik: A.CIK.pscm, filed: '2022-11-14', rows: [Object.assign({}, extra, { value: 7 })], primary: {} })]);
ok(C.rows[0].value === 7000, 'איחוד: דוח לפני 2023 — השווי באלפים מוכפל');
C = A.consolidateQuarter([{ form: '13F-HR', filed: '2025-08-14', cik: A.CIK.psinc, acc: 'h', primary: { included: [] }, rows: [extra] }]);
ok(C.rows.length === 0, 'איחוד: דוח של Holdco בלי מנהלים כלולים (לפני המעבר) — לא התיק של הקרנות');
ok(A.consolidateQuarter([{ form: '13F-NT', filed: '2026-08-14', rows: [] }]).rows.length === 0, 'איחוד: 13F-NT (הודעה בלבד) — מדלגים');

/* ---- Form 4 ---- */
const G = A.parseForm4(FX('form4-hhc-2018-11-08.xml'));
ok(G.form === '4' && G.period === '2018-11-08' && G.issuer.ticker === 'HHC' && G.issuer.cik === '1498828', 'Form 4: סוג, תאריך, המנפיק');
ok(G.owners.length === 3 && G.owners.some((o) => /ACKMAN/i.test(o.name)), 'Form 4: שלושה מדווחים (PSCM, השותף הכללי, אקמן)');
const s = G.tx.find((t) => !t.deriv);
ok(s.code === 'S' && s.ad === 'D' && s.shares === 899647 && s.price === 109.39 && s.after === 1233589 && s.direct === 'I', 'Form 4: מכירה — כמות, מחיר, יתרה אחרי');
const d = G.tx.find((t) => t.deriv);
ok(d.code === 'J' && d.exercise === 109.39 && d.underlying === 40487 && d.expires === '2019-12-02' && d.price === null, 'Form 4: עסקת החלף — מחיר מימוש, מניות בבסיס, תפוגה; בלי מחיר (בהערה)');
ok(s.footnoteIds.length === new Set(s.footnoteIds).size && G.notes[s.footnoteIds[0]] && /sale of common stock/i.test(G.notes.F4), 'Form 4: הערות השוליים — בלי כפילויות, עם הטקסט');

console.log(`\nכל ${n} הבדיקות עברו ✓`);
