/* שכבה 8 בבקרת הדיוק של מנתח החברות (26/10/2026): כל ערך מול כמה מקורות בלתי תלויים.
   טהור — בלי רשת. tools/fund-xcheck.js מביא את המקורות ומריץ.
   המקורות: (1) SEC גולמי — אותה תגית, ההגשה האחרונה, חישוב נפרד ופשוט של הרבעון (שנה פחות 9 חודשים);
   כשהערך שלנו מחושב (רווח גולמי = הכנסות − עלות, סך התחייבויות = סך התחייבויות והון − הון, השקעות הוניות = סכום תגיות,
   רבעון רביעי = שנה − שלושה רבעונים) — אותה נוסחה מחדש מהערכים הגולמיים של SEC (rf);
   (2) הדוח כפי שהודפס (faceCheck — הסימון 'face' ב־checks); (3) Yahoo (כולל שדות חלופיים — "מילון ההגדרות"); (4) Nasdaq (EDGAR Online).
   הכרעה לכל ערך:
     ok   — תואם את כל המקורות שיש;
     okd  — שונה ממקור חיצוני בהגדרה ידועה שלו (DEFS), ותואם את הגדרת החלופה שלו — לא טעות של אף אחד (why = מזהה ההגדרה);
     est  — ערך שאין לו מקור (רבעון רביעי של רווח למניה / ממוצע מניות) ותואם את האומדן מ־SEC (שנה פחות שלושה רבעונים);
     estx — כמו est, אבל רחוק מהאומדן — לבדוק;
     def  — תואם את SEC (או מקור חיצוני אחד), ומקור חיצוני אחר שונה בלי הסבר ידוע (why כשיש הסבר שהוא בחירה שלנו);
     ext  — שני המקורות החיצוניים קרובים זה לזה (עד 5%) ורחוקים מאיתנו, ואנחנו = SEC — לבדוק את בחירת התגית;
     spl  — מניות / רווח למניה ביחס של פיצול שמופיע ברשימת הפיצולים — לא הוחל אצלנו (או הוחל פעמיים);
     bug  — שונה מ־SEC הגולמי של אותה תגית / מאותה נוסחה, או שהדוח המודפס שונה, או "שנה" שהיא לא שנה (ttm);
     one  — רק מקור אחד, ושונה — לבדוק;
     yfill — שורה שאין ב־SEC ו־fundamentals השלים מ־Yahoo: Yahoo הוא המקור, לא בדיקה (nd = Nasdaq שונה);
     none — אין אף מקור ואין נוסחה לבדוק. */

const DAY = 864e5;
const day = (e) => Date.parse(e + 'T00:00:00Z') / DAY;
const nearEnd = (list, e, tol = 20) => { let b = -1, bd = 1e9; (list || []).forEach((x, i) => { const d = Math.abs(day(x) - day(e)); if (d < bd) { bd = d; b = i; } }); return bd <= tol ? b : -1; };
const nearKey = (o, e, tol = 20) => { if (!o) return null; let b = null, bd = 1e9; for (const k of Object.keys(o)) { const d = Math.abs(day(k) - day(e)); if (d < bd) { bd = d; b = k; } } return bd <= tol ? o[b] : null; };

const PER_SHARE = new Set(['eps', 'dps']);
const NOSUM = new Set(['eps', 'dps', 'sh']);
// סטייה מותרת: 0.5% (נבדק 26/10/2026 על 30 חברות: Yahoo ו־Nasdaq מדויקים עד הדולר / האלף — 92% מההתאמות זהות לגמרי,
// ואין def שנובע מעיגול; בין 0.1% ל־0.5% יש הבדלי הגדרה קטנים אמיתיים — מסומנים near), למניה — סנט;
// ערכים קטנים מאוד (מתחת ל־0.1% מההכנסות) — עד ‎$2M
function same(m, a, b, scale) {
  if (a == null || b == null) return null;
  if (PER_SHARE.has(m)) return Math.abs(a - b) <= 0.011 + 0.002 * Math.abs(b);
  const d = Math.abs(a - b), mx = Math.max(Math.abs(a), Math.abs(b));
  return d <= 0.005 * mx || d <= Math.max(2e6, 1e-3 * (scale || 0));
}
const relDiff = (a, b) => { const mx = Math.max(Math.abs(a), Math.abs(b)); return mx ? Math.abs(a - b) / mx : 0; };

/* ---------- Nasdaq: api.nasdaq.com/api/company/<SYM>/financials?frequency=1|2 (ערכים באלפים) ---------- */
const NQ_ROWS = {
  incomeStatementTable: { 'Total Revenue': 'rev', 'Cost of Revenue': 'cogs', 'Gross Profit': 'gp', 'Research and Development': 'rnd', 'Operating Income': 'op',
    'Earnings Before Tax': 'pretax', 'Income Tax': 'tax', 'Net Income': 'ni', 'Net Income Applicable to Common Shareholders': 'nic' },
  balanceSheetTable: { 'Cash and Cash Equivalents': 'cash', 'Short-Term Investments': 'sti', 'Total Current Assets': 'ca', 'Total Assets': 'ta', 'Total Current Liabilities': 'cl', 'Total Liabilities': 'tl',
    'Stock Holders Equity': 'eq', 'Total Equity': 'teq', 'Minority Interest': 'mi', 'Retained Earnings': 're', 'Fixed Assets': 'ppe' },
  cashFlowTable: { 'Net Cash Flow-Operating': 'ocf', 'Capital Expenditures': 'capex', 'Depreciation': 'dep' },
};
const NQ_ABS = new Set(['capex', 'cogs', 'tax', 'rnd']);
function nqNum(s) {
  if (s == null) return null;
  const t = String(s).replace(/[$,\s]/g, '');
  if (!t || t === '--') return null;
  const neg = /^-|^\(.*\)$/.test(t), v = parseFloat(t.replace(/[()-]/g, ''));
  return Number.isFinite(v) ? (neg ? -v : v) * 1000 : null;
}
function nqDate(s) { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || '').trim()); return m ? m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0') : null; }
function parseNasdaq(j) {
  const d = j && j.data; if (!d) return null;
  const out = { ends: [], v: {} };
  for (const [tb, map] of Object.entries(NQ_ROWS)) {
    const t = d[tb]; if (!t || !t.headers || !t.rows) continue;
    const cols = Object.keys(t.headers).filter((k) => k !== 'value1');
    const ends = cols.map((c) => nqDate(t.headers[c]));
    for (const r of t.rows) {
      const k = map[String(r.value1 || '').trim()]; if (!k) continue;
      cols.forEach((c, i) => {
        const e = ends[i]; if (!e) return;
        let v = nqNum(r[c]); if (v == null) return;
        if (NQ_ABS.has(k)) v = Math.abs(v);
        (out.v[k] = out.v[k] || {})[e] = v;
        if (!out.ends.includes(e)) out.ends.push(e);
      });
    }
  }
  out.ends.sort();
  return out;
}

/* ---------- Yahoo: השדות הגולמיים (בלי השלמת רבעון רביעי) — להגדרות החלופיות ולזיהוי ערך ש־parseYahooTs חישב ---------- */
// השדה הראשי לכל מדד (= YMAP של fundamentals) — ערך של parseYahooTs שאין לו שדה גולמי בתאריך = רבעון רביעי ש־Yahoo לא פרסם וחושב
const YPRIM = { rev: 'TotalRevenue', gp: 'GrossProfit', op: 'OperatingIncome', ni: 'NetIncomeCommonStockholders', eps: 'DilutedEPS', sh: 'DilutedAverageShares',
  ocf: 'OperatingCashFlow', capex: 'CapitalExpenditure', cash: 'CashAndCashEquivalents', ta: 'TotalAssets', tl: 'TotalLiabilitiesNetMinorityInterest',
  eq: 'StockholdersEquity', ca: 'CurrentAssets', cl: 'CurrentLiabilities' };
// השדות החלופיים שהכלי מבקש בנוסף (tools/fund-xcheck.js)
const YALT_TYPES = ['TotalOperatingIncomeAsReported', 'OperatingRevenue', 'NetIncome', 'NetIncomeFromContinuingOperationNetMinorityInterest', 'BasicEPS', 'BasicAverageShares',
  'PurchaseOfPPE', 'CapitalExpenditureReported', 'NetPPEPurchaseAndSale', 'CashFinancial', 'CashCashEquivalentsAndFederalFundsSold',
  'CashCashEquivalentsAndShortTermInvestments', 'TotalEquityGrossMinorityInterest', 'CommonStockEquity'];
function parseYahooAlt(j) {
  const o = { A: {}, Q: {} };
  for (const r of (j && j.timeseries && j.timeseries.result) || []) {
    const t = r.meta && r.meta.type && r.meta.type[0]; if (!t) continue;
    const p = t.startsWith('annual') ? 'A' : t.startsWith('quarterly') ? 'Q' : null; if (!p) continue;
    const k = t.slice(p === 'A' ? 6 : 9);
    for (const x of r[t] || []) if (x && x.reportedValue && x.reportedValue.raw != null) (o[p][k] = o[p][k] || {})[x.asOfDate] = x.reportedValue.raw;
  }
  return o;
}

/* ---------- מילון ההגדרות: הבדל ידוע בין ההגדרה של מקור חיצוני לשלנו ----------
   לכל מדד — רשימת הסברים. הסבר "מתאים" כשהערך שלנו שווה לשדה החלופי של אותו מקור (y), או כשהמקור שווה לתגית SEC אחרת (sec),
   או לערך שלנו ועוד תגית SEC (plus). ok:true = הגדרה של המקור בלבד → okd; בלי ok = הבחירה שלנו (התגית) — נשאר def/ext עם why, כדי שיראו.
   lim = יחס מרבי בין הערכים (בלי — כל יחס), כדי שהסבר לא יכסה ערך שרחוק פי כמה (AEP: ההשקעות ההוניות שלנו 2% מהאמת). */
const DEFS = {
  op: [{ id: 'y_op_asrep', s: 'y', y: ['TotalOperatingIncomeAsReported'], ok: true }], // Yahoo "OperatingIncome" = בלי פריטים חריגים (ארגון מחדש, ירידת ערך, IPR&D)
  ni: [{ id: 'y_ni_total', s: 'y', y: ['NetIncome', 'NetIncomeFromContinuingOperationNetMinorityInterest'], ok: true }, // Yahoo "לבעלי המניות" מנכה ניירות משתתפים / בכורה
    { id: 'n_ni_total', s: 'n', n: ['ni'], ok: true }],
  rev: [{ id: 'y_rev_op', s: 'y', y: ['OperatingRevenue'], ok: true }, // Yahoo TotalRevenue כולל רווחי השקעות (מבטחים) / ההפך
    { id: 'n_rev_gross', s: 'n', plus: ['InterestExpense', 'InterestExpenseOperating'], ok: true }, // Nasdaq בבנקים: הכנסות ריבית ברוטו
    { id: 'fin_rev', s: 'yn', when: (c) => c.fin }, // בנק/מבטח: הכנסות נטו מול ברוטו, רווחי השקעות — כל מקור אחרת
    { id: 'rev_ctr', s: 'yn', sec: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax'], lim: 1.25 }], // אנחנו "Revenues" (כולל הכנסות אחרות) — בחירה
  cash: [{ id: 'y_cash_fin', s: 'y', y: ['CashFinancial', 'CashCashEquivalentsAndFederalFundsSold'], ok: true }, // בנקים: Yahoo כולל פיקדונות בבנק המרכזי
    { id: 'n_cash_restr', s: 'n', sec: ['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'], ok: true, // Nasdaq = כולל מזומן מוגבל / מופרד
      plus: ['RestrictedCashAndCashEquivalentsAtCarryingValue', 'RestrictedCash', 'RestrictedCashCurrent', 'RestrictedCashAndCashEquivalentsCurrent',
        'RestrictedCashAndInvestmentsCurrent', 'CashAndSecuritiesSegregatedUnderFederalAndOtherRegulations', 'CashSegregatedUnderOtherRegulations'] },
    { id: 'y_cash_sti', s: 'y', y: ['CashCashEquivalentsAndShortTermInvestments'] },
    { id: 'fin_cash', s: 'yn', when: (c) => c.fin, ok: true }], // בנק: "מזומן" = מזומן ופיקדונות בבנקים — כל מקור כולל רכיבים אחרים, ולא משמש בניתוח בנק
  capex: [{ id: 'y_capex_ppe', s: 'y', y: ['PurchaseOfPPE', 'CapitalExpenditureReported', 'NetPPEPurchaseAndSale'], abs: true, ok: true }, // Yahoo CapitalExpenditure כולל נכסים בלתי מוחשיים
    { id: 'capex_intang', s: 'yn', plus: ['PaymentsToAcquireIntangibleAssets', 'PaymentsToAcquireSoftware', 'PaymentsForSoftware', 'PaymentsForNuclearFuel'], lim: 3 }], // תוכנה שהוונה / דלק גרעיני — בחירה שלנו
  eq: [{ id: 'y_eq_nci', s: 'y', y: ['TotalEquityGrossMinorityInterest'] }, // ההון שלנו כולל זכויות מיעוט — בחירה (לתשואה על ההון עדיף בלי)
    { id: 'y_eq_common', s: 'y', y: ['CommonStockEquity'] }],
  sh: [{ id: 'y_sh_basic', s: 'y', y: ['BasicAverageShares'] }],
  gp: [{ id: 'gp_calc', s: 'yn', when: (c) => c.gpc }], // אין שורת רווח גולמי בדוח — כל מקור מחשב אחרת (Chevron, Honeywell, UnitedHealth) — בחירה: אולי לא להציג
  eps: [{ id: 'y_eps_basic', s: 'y', y: ['BasicEPS'] }],
};

/* ---------- SEC גולמי: אותה תגית, חישוב נפרד ---------- */
// companyfacts → לכל תקופה (start|end או end) הערך מההגשה האחרונה (10-K/10-Q/20-F/40-F ותיקוניהם)
const FORMS = /^(10-K|10-Q|20-F|40-F|10-KT|10-QT)(\/A)?$/;
// adj = { splits, ps } — למניות / רווח למניה: ערך מהגשה שלפני פיצול מוכפל (מניות) / מחולק (רווח למניה) ביחס הפיצול,
// כדי ש־SEC הגולמי יהיה באותו בסיס כמו הערך שלנו אחרי הפיצול (Netflix 10:1 בנובמבר 2025: 2022 מופיע רק בהגשות שלפניו)
function adjFactor(adj, filed) { if (!adj || !adj.splits) return 1; let r = 1; for (const [sd, x] of adj.splits) if (sd > filed && Math.abs(Math.log(x)) > Math.log(1.3)) r *= x; return adj.ps ? 1 / r : r; }
function rawSeries(facts, tag, adj) {
  if (!facts || !tag) return null;
  if (/\+/.test(tag)) { // סכום תגיות (השקעות הוניות בחלקים) — כל תקופה שכל החלקים קיימים בה
    const parts = tag.split('+').map((t) => rawSeries(facts, t, adj));
    if (parts.some((p) => !p)) return null;
    const sum = (k) => { const M = new Map(); for (const [key, h] of parts[0][k]) { let v = h.v, f = h.filed, okk = true; for (const p of parts.slice(1)) { const x = p[k].get(key); if (!x) { okk = false; break; } v += x.v; if (x.filed > f) f = x.filed; } if (okk) M.set(key, { v, filed: f }); } return M; };
    return { dur: sum('dur'), inst: sum('inst') };
  }
  for (const ns of ['us-gaap', 'ifrs-full']) {
    const g = facts.facts && facts.facts[ns] && facts.facts[ns][tag]; if (!g) continue;
    const dur = new Map(), inst = new Map();
    for (const rows of Object.values(g.units || {})) for (const x of rows) {
      if (!FORMS.test(x.form || '') || x.val == null) continue;
      const key = x.start ? x.start + '|' + x.end : x.end, M = x.start ? dur : inst, h = M.get(key);
      const v = x.val * adjFactor(adj, x.filed);
      if (!h || x.filed > h.filed) M.set(key, { v, filed: x.filed, vk: h && h.vk, fk: h && h.fk });
      // הערך מהדוח השנתי האחרון — במאזן 10-K גובר על 10-Q מאוחר (המדיניות של fundamentals; Honeywell: 10-Q של 2026 הציג מחדש את 31/12/2025)
      const g2 = M.get(key);
      if (/^(10-K|20-F|40-F|10-KT)/.test(x.form) && (!g2.fk || x.filed > g2.fk)) { g2.vk = v; g2.fk = x.filed; }
    }
    return { dur, inst };
  }
  return null;
}
// ערך לתקופה: שנה (s..e ‏~365), רבעון — ישיר (~91) או מצטבר שנה פחות מצטבר קודם (חישוב משלו, בלי לגעת בקוד של השרתון);
// ובסוף שנה בלי מצטבר (חברה שמדווחת רבעונים ישירים): השנה פחות שלושת הרבעונים הישירים שבתוכה
function rawAt(rs, e, kind, fyStart, k10) {
  if (!rs) return null;
  if (rs.inst.size && !rs.dur.size) { for (const [k, h] of rs.inst) if (Math.abs(day(k) - day(e)) <= 3) return k10 ? (h.vk != null ? h.vk : null) : h.v; return null; }
  const pick = (lo, hi, end) => { let best = null; for (const [k, h] of rs.dur) { const [s, en] = k.split('|'); if (Math.abs(day(en) - day(end)) > 3) continue; const L = day(en) - day(s); if (L >= lo && L <= hi && (!best || h.filed > best.filed)) best = h; } return best; };
  const best = kind === 'A' ? pick(350, 380, e) : pick(80, 100, e);
  if (best || kind === 'A' || !fyStart) return best ? best.v : null;
  // רבעון בלי ערך ישיר: המצטבר עד e פחות המצטבר עד הרבעון הקודם — שניהם מתחילים בתחילת אותה שנה
  let cum = null, prev = null;
  for (const [k, h] of rs.dur) {
    const [s, en] = k.split('|'); if (Math.abs(day(s) - day(fyStart)) > 3) continue;
    const off = day(e) - day(en);
    if (Math.abs(off) <= 3) cum = h.v;
    else if (off >= 80 && off <= 100 && (!prev || h.filed > prev.filed)) prev = { v: h.v, filed: h.filed };
  }
  if (cum != null && day(e) - day(fyStart) < 100) return cum;
  if (cum != null && prev) return cum - prev.v;
  // סוף שנה, רבעונים ישירים בלבד: השנה פחות שלושה רבעונים (כל אחד ~91 יום, בתוך השנה)
  const yr = pick(350, 380, e);
  if (!yr) return null;
  const qs = [];
  for (const [k, h] of rs.dur) { const [s, en] = k.split('|'), L = day(en) - day(s); if (L >= 80 && L <= 100 && day(s) >= day(fyStart) - 3 && day(e) - day(en) >= 80) qs.push([en, h]); }
  const by = new Map(); for (const [en, h] of qs) { const b = by.get(en); if (!b || h.filed > b.filed) by.set(en, h); }
  return by.size === 3 ? yr.v - [...by.values()].reduce((t, h) => t + h.v, 0) : null;
}
// סכום הרבעונים בתוך השנה (ממוצע מניות / רווח למניה — רק ישירים)
function rawQuarters(rs, e, fyStart) {
  if (!rs || !fyStart) return null;
  const by = new Map();
  for (const [k, h] of rs.dur) { const [s, en] = k.split('|'), L = day(en) - day(s); if (L >= 80 && L <= 100 && day(s) >= day(fyStart) - 3 && day(e) - day(en) >= 80) { const b = by.get(en); if (!b || h.filed > b.filed) by.set(en, h); } }
  return by.size === 3 ? [...by.values()].map((h) => h.v) : null;
}

/* ---------- ההשוואה ---------- */
const XK = ['rev', 'gp', 'op', 'ni', 'eps', 'sh', 'ocf', 'capex', 'cash', 'ta', 'tl', 'eq', 'ca', 'cl'];
const BAL = new Set(['cash', 'ta', 'tl', 'eq', 'ca', 'cl']);
const YK = { ni: 'ni' }; // Yahoo: NetIncomeCommonStockholders — מול nic כשיש
// ערך שלנו שמחושב בנוסחה (לא תגית אחת) — אותה נוסחה מ־SEC הגולמי
// (כמו "שורות מחושבות" ב־normalizeSec; ההון — כולל זכויות מיעוט כשיש לתקופה, אחרת של בעלי המניות)
function rawFormula(m, d, at) {
  const t = d.tags || {};
  if (m === 'gp' && t.rev && t.cogs) { const a = at(t.rev), b = at(t.cogs); return a != null && b != null ? { v: a - b, rf: 'rev-cogs' } : null; }
  if (m === 'tl' && t.tle && (t.eqt || t.eq)) {
    const a = at(t.tle), b = (t.eqt && at(t.eqt)) ?? (t.eq ? at(t.eq) : null), c = t.tmp ? at(t.tmp) : 0;
    return a != null && b != null ? { v: a - b - (c || 0), rf: 'tle-eq' } : null;
  }
  return null;
}
// פיצולים אחרי התקופה (יחס מצטבר) — לזיהוי spl
function splitRatioAfter(splits, e) { let r = 1; for (const [sd, x] of splits || []) if (sd > e && Math.abs(Math.log(x)) > Math.log(1.3)) r *= x; return r; }
// הסבר מהמילון: האם ההבדל מול המקור s ידוע. ctx = { ya (Yahoo גולמי לתקופה), nq (Nasdaq לתקופה), sec(tag) → ערך גולמי }
function explain(m, s, ours, ext, ctx, sc) {
  for (const D of DEFS[m] || []) {
    if (!D.s.includes(s)) continue;
    if (D.when) { if (D.when(ctx)) return D; continue; }
    if (D.lim && ours && ext && Math.max(Math.abs(ours / ext), Math.abs(ext / ours)) > D.lim) continue;
    let hit = false;
    if (s === 'y' && D.y) for (const ty of D.y) { const v = ctx.ya && ctx.ya[ty]; if (v != null && same(m, ours, D.abs ? Math.abs(v) : v, sc)) hit = true; }
    if (s === 'n' && D.n) for (const k of D.n) { const v = ctx.nq && ctx.nq[k]; if (v != null && same(m, ours, v, sc)) hit = true; }
    if (!hit && D.sec) for (const tag of D.sec) { const v = ctx.sec(tag); if (v != null && same(m, Math.abs(ext), Math.abs(v), sc)) hit = true; }
    if (!hit && D.plus) {
      const vs = D.plus.map((tag) => ctx.sec(tag)).filter((v) => v != null);
      if (vs.some((v) => same(m, Math.abs(ext), Math.abs(ours) + Math.abs(v), sc)) || (vs.length > 1 && same(m, Math.abs(ext), Math.abs(ours) + vs.reduce((t, v) => t + Math.abs(v), 0), sc))) hit = true;
    }
    if (hit) return D;
  }
  return null;
}

// אומדן לערך שאין לו מקור — רק למניות ולרווח למניה (לא מצטברים, אז SEC לא מדווח רבעון רביעי):
// רבעון רביעי = השנה פחות שלושה רבעונים (מניות: 4 × ממוצע השנה פחות שלושה); אחרת רווח למניה = רווח (לבעלי המניות) ÷ מניות, מ־SEC
function estimate(m, kind, e, rs, d, facts, adj, fyS, fs0, secAt) {
  if (!NOSUM.has(m) || m === 'dps') return null;
  if (kind === 'Q' && rs && d.fy.includes(e)) {
    const a = rawAt(rs, e, 'A'), qs = rawQuarters(rs, e, fyS(e));
    if (a != null && qs) return m === 'sh' ? 4 * a - qs.reduce((t, x) => t + x, 0) : a - qs.reduce((t, x) => t + x, 0);
  }
  if (m !== 'eps' || !facts) return null;
  const t = d.tags || {};
  const ni = (t.nic && secAt(t.nic, e, kind, fs0)) ?? (t.ni ? secAt(t.ni, e, kind, fs0) : null);
  const shr = t.sh ? rawSeries(facts, t.sh, { splits: d.splits }) : null;
  let sh = shr ? rawAt(shr, e, kind) : null;
  if (sh == null && kind === 'Q' && shr && d.fy.includes(e)) { const a = rawAt(shr, e, 'A'), qs = rawQuarters(shr, e, fyS(e)); if (a != null && qs) sh = 4 * a - qs.reduce((x, y) => x + y, 0); }
  return ni != null && sh ? ni / sh : null;
}

/* d = תשובת fundamentals (src sec), facts = companyfacts, y = parseYahooTs, nq = { A: parseNasdaq(שנתי), Q: parseNasdaq(רבעוני) },
   opt.cand = { m: [תגיות מועמדות] } (רשות — F.TAGS; בלעדיו רק התגית הראשית), opt.ya = parseYahooAlt (רשות — בלעדיו אין הגדרות Yahoo חלופיות ואין זיהוי של רבעון רביעי ש־Yahoo לא פרסם)
   מחזיר רשימת ערכים: { m, k:'A'|'Q', p, v, raw, y, n, face, c, why?, rf?, est?, yd?, yf?, near? } — c = ההכרעה */
function xcheck(d, facts, y, nq, opt = {}) {
  const out = [];
  if (!d || !d.ok || !d.tags) return out;
  const nA = opt.nA || 5, nQ = opt.nQ || 8, YA = opt.ya || null;
  const faceBad = new Set((d.checks || []).filter((c) => c.k === 'face').map((c) => c.m + '|' + c.p));
  const fyS = (e) => { const i = d.fy.indexOf(e); return i > 0 ? new Date((day(d.fy[i - 1]) + 1) * DAY).toISOString().slice(0, 10) : null; };
  const fyOf = (qe) => d.fy.find((e) => day(e) >= day(qe) - 1 && day(e) - day(qe) < 366);
  const scaleA = (i) => Math.abs((d.A.rev && d.A.rev[i]) || 0);
  const fin = d.sic >= 6000 && d.sic < 6500; // בנקים, ברוקרים, ביטוח — Yahoo/Nasdaq מתקננים את הדוחות שלהם אחרת
  const fill = new Set(d.fill || []); // שורות שהושלמו מ־Yahoo (אין ב־SEC) — Yahoo הוא המקור שלהן, לא בדיקה
  // "שנים" שהן לא שנה (Amazon: דוחות רבעוניים עם 12 חודשים אחרונים — כל רבעון נראה כסוף שנה)
  const ttm = new Set(d.fy.filter((e, i) => i > 0 && day(e) - day(d.fy[i - 1]) < 300));
  const rsCache = {}, secAt = (tag, e, kind, fs) => { if (!(tag in rsCache)) rsCache[tag] = rawSeries(facts, tag); return rawAt(rsCache[tag], e, kind, fs); };
  for (const kind of ['A', 'Q']) {
    const ends = kind === 'A' ? d.fy : d.q, D = kind === 'A' ? d.A : d.Q;
    const from = Math.max(0, ends.length - (kind === 'A' ? nA : nQ));
    for (const m of XK) {
      if (!D[m]) continue;
      const adj = NOSUM.has(m) ? { splits: d.splits, ps: PER_SHARE.has(m) } : null;
      const tag = d.tags[m], rs = rawSeries(facts, tag, adj);
      // תגיות חלופיות (מועמדות ב־fundamentals — mergeTags משלים מהן תקופות שאין בתגית הראשית)
      const alts = ((opt.cand && opt.cand[m]) || []).filter((t) => t !== tag).map((t) => [t, rawSeries(facts, t, adj)]).filter(([, x]) => x);
      for (let i = from; i < ends.length; i++) {
        const e = ends[i];
        let v = D[m][i]; if (v == null) continue;
        if (m === 'ni' && D.nic && D.nic[i] != null) v = { v, c: D.nic[i] }; // רווח לבעלי המניות — מול Yahoo/Nasdaq
        const vv = typeof v === 'object' ? v.v : v, vc = typeof v === 'object' ? v.c : v;
        const sc = kind === 'A' ? scaleA(i) : scaleA(d.fy.length - 1) / 4;
        const fs0 = kind === 'A' || BAL.has(m) ? null : fyS(fyOf(e)) || null;
        let raw = null, rf = null;
        // רווח למניה וממוצע מניות לא מצטברים — רק ערך ישיר (בלי שנה פחות 9 חודשים)
        const fsr = NOSUM.has(m) ? null : fs0;
        if (rs) raw = rawAt(rs, e, kind, fsr);
        if (raw == null) for (const [t, x] of alts) { const v2 = rawAt(x, e, kind, fsr); if (v2 != null) { raw = v2; rf = t; break; } }
        if (raw == null && facts) { const f = rawFormula(m, d, (t) => secAt(t, e, kind, BAL.has(m) ? null : fs0)); if (f) { raw = f.v; rf = f.rf; } }
        if (raw != null && m === 'capex') raw = Math.abs(raw);
        const rawK = BAL.has(m) && rs && !rf ? rawAt(rs, e, kind, null, true) : null;
        const yi = y && nearEnd(kind === 'A' ? y.fy : y.q, e, 20), ys = y && (kind === 'A' ? y.A : y.Q);
        let yv = yi >= 0 && ys && ys[YK[m] || m] ? ys[YK[m] || m][yi] : null;
        const ya = YA ? Object.fromEntries(Object.entries(YA[kind]).map(([t, o]) => [t, nearKey(o, e)]).filter(([, x]) => x != null)) : null;
        // רבעון רביעי ש־Yahoo לא פרסם וחושב ב־parseYahooTs (שנה − 3 רבעונים; למניות — ממוצע שלושת האחרים): לא מקור למניות / רווח למניה
        const yd = !!(ya && yv != null && kind === 'Q' && ya[YPRIM[m]] == null);
        if (yd && NOSUM.has(m)) yv = null;
        const yf = kind === 'A' && fill.has(m) && raw == null;
        const N = nq && nq[kind], ni = N ? nearEnd(N.ends, e, 20) : -1;
        const nk = m === 'ni' ? 'nic' : m;
        let nv = ni >= 0 && N.v[nk] ? N.v[nk][N.ends[ni]] ?? null : null;
        const nqAt = ni >= 0 ? Object.fromEntries(Object.entries(N.v).map(([k, o]) => [k, o[N.ends[ni]]]).filter(([, x]) => x != null)) : null;
        const face = faceBad.has(m + '|' + e) ? false : null;
        const r = { m, k: kind, p: e, v: vv, raw, y: yv, n: nv, face, der: !!(d.derived && d.derived[m] && d.derived[m].includes(e)) };
        if (rf) r.rf = rf; if (yd) r.yd = 1; if (yf) r.yf = 1;
        // ni: מול Yahoo/Nasdaq גם הרווח הכולל וגם הרווח לבעלי המניות — Nasdaq ‏"Applicable to Common" לפעמים = הכולל
        const sm = (a) => (a == null ? null : same(m, vc, a, sc) || (m === 'ni' && same(m, vv, a, sc)) ? true : false);
        const srMain = same(m, vv, raw, sc), srK = rawK != null ? same(m, vv, rawK, sc) : null;
        const sr = srMain === true || srK === true ? true : srMain, sn = sm(nv), syRaw = sm(yv), sy = yf ? null : syRaw, yn = same(m, yv, nv, sc);
        const ctx = { ya, nq: nqAt, sec: (t) => secAt(t, e, kind, BAL.has(m) ? null : fs0), fin, gpc: m === 'gp' && (rf === 'rev-cogs' || !d.tags.gp) };
        // מספר מניות שהחברה הגישה בקנה מידה שגוי ותוקן אצלנו (fixes) — SEC הגולמי פי אלף / מיליון קטן
        const fixd = sr === false && m === 'sh' && raw > 0 && [1e3, 1e6].some((f) => Math.abs(vv / raw / f - 1) < 0.02);
        // פיצול: היחס מול מקור חיצוני = הפיצולים שאחרי התקופה (או ההפך) — אנחנו לא החלנו / החלנו פעמיים
        const spr = NOSUM.has(m) ? splitRatioAfter(d.splits, e) : 1;
        const splitOff = (x) => { if (spr === 1 || x == null || !vv || !x) return false; const q = m === 'sh' ? x / vv : vv / x; return Math.abs(q / spr - 1) < 0.03 || Math.abs(q * spr - 1) < 0.03; };
        // ההסבר לכל מקור שונה
        const ex = {};
        for (const [s, ok, val] of [['y', sy, yv], ['n', sn, nv]]) if (ok === false) ex[s] = explain(m, s, m === 'ni' ? vv : vc, val, ctx, sc);
        const okS = (s, ok) => ok !== false || (ex[s] && ex[s].ok);
        if (ttm.has(e) && kind === 'A') { r.c = 'bug'; r.why = 'ttm'; }
        // שורה שהושלמה מ־Yahoo (אין ב־SEC): Yahoo הוא המקור שלה — רק Nasdaq יכול לאשר
        else if (yf && sn !== true) { r.c = 'yfill'; if (sn === false) r.nd = 1; }
        else if (fixd) r.c = sy === false || sn === false ? 'one' : 'fix';
        else if (splitOff(raw) || splitOff(yv) || splitOff(nv)) { r.c = 'spl'; r.why = 'split_' + Math.round(spr * 1000) / 1000; }
        else if (sr === false || face === false) r.c = 'bug';
        else if (okS('y', sy) && okS('n', sn)) {
          if (sy == null && sn == null && sr == null) {
            // אין מקור: רבעון רביעי של רווח למניה / ממוצע מניות — אומדן מ־SEC: השנה פחות שלושה רבעונים
            const est = estimate(m, kind, e, rs, d, facts, adj, fyS, fs0, secAt);
            if (est != null) {
              r.est = m === 'sh' ? Math.round(est) : Math.round(est * 1000) / 1000;
              // רווח למניה: סכום רבעונים ≠ שנה כשמספר המניות זז / יש הפסד ברבעון — עד 5 סנט או 5%; מניות — 1%
              const okE = m === 'sh' ? relDiff(vv, est) <= 0.01 : Math.abs(vv - est) <= Math.max(0.05, 0.05 * Math.abs(vv));
              r.c = okE ? 'est' : 'estx';
            } else r.c = 'none';
          } else {
            const exp = Object.values(ex).find((x) => x && x.ok);
            if (exp) { r.c = 'okd'; r.why = exp.id; } else r.c = 'ok';
          }
        } else {
          const fy = sy === false && !(ex.y && ex.y.ok), fn = sn === false && !(ex.n && ex.n.ok);
          const why = (fy && ex.y && ex.y.id) || (fn && ex.n && ex.n.id) || null;
          // שני המקורות החיצוניים קרובים זה לזה (עד 5%), באותו צד שלנו, ורחוקים מאיתנו פי 2 מהמרחק ביניהם — לא "הגדרה" של אחד מהם
          const close = fy && fn && yv != null && nv != null && (yn === true || (relDiff(yv, nv) <= 0.05 && Math.sign(yv - vc) === Math.sign(nv - vc) &&
            Math.abs(vc - (yv + nv) / 2) > 2 * Math.abs(yv - nv)));
          if (close) { r.c = sr === true ? 'ext' : 'one'; if (yn !== true) r.xl = 1; }
          else if (sr === true || sy === true || sn === true || (ex.y && ex.y.ok) || (ex.n && ex.n.ok)) r.c = 'def'; // SEC או מקור חיצוני אחר מאשר אותנו
          else {
            // מקור אחד ושונה, בלי SEC: האומדן מ־SEC (רבעון רביעי של מניות / רווח למניה) מכריע
            const est = sr == null ? estimate(m, kind, e, rs, d, facts, adj, fyS, fs0, secAt) : null;
            if (est != null) r.est = m === 'sh' ? Math.round(est) : Math.round(est * 1000) / 1000;
            r.c = est != null && (m === 'sh' ? relDiff(vv, est) <= 0.01 : Math.abs(vv - est) <= Math.max(0.05, 0.05 * Math.abs(vv))) ? 'def' : 'one';
            if (r.c === 'def') r.why = r.why || 'est';
          }
          if (why) r.why = why;
        }
        // הבדל קטן (0.1%–0.5%) שעבר כ־ok — לסטטיסטיקה (הגדרה קטנה, לא עיגול)
        if (r.c === 'ok' || r.c === 'okd') for (const x of [r.y, r.n]) if (x != null && !PER_SHARE.has(m) && relDiff(vc, x) > 1e-3 && relDiff(vc, x) <= 5e-3) r.near = 1;
        out.push(r);
      }
    }
  }
  return out;
}

/* סיכום: לכל הכרעה, לכל מדד ולכל חברה; ולכל הסבר (why) */
const PROBLEM = new Set(['bug', 'ext', 'one', 'spl', 'estx']); // לא בעיה: ok, okd, est, def, yfill, fix, none
function summarizeX(rows) {
  const S = { n: 0, c: {}, byM: {}, why: {}, cos: {} };
  for (const { sym, x } of rows) {
    for (const r of x) {
      S.n++; S.c[r.c] = (S.c[r.c] || 0) + 1;
      const b = (S.byM[r.k + ':' + r.m] = S.byM[r.k + ':' + r.m] || {}); b[r.c] = (b[r.c] || 0) + 1;
      if (r.why) { const w = (S.why[r.c + ':' + r.why] = S.why[r.c + ':' + r.why] || 0); S.why[r.c + ':' + r.why] = w + 1; }
      if (PROBLEM.has(r.c)) (S.cos[sym] = S.cos[sym] || []).push(r);
    }
  }
  return S;
}

module.exports = { xcheck, summarizeX, parseNasdaq, parseYahooAlt, rawSeries, rawAt, rawQuarters, estimate, same, explain, XK, DEFS, YALT_TYPES, YPRIM, PROBLEM };
