/* שכבה 8 בבקרת הדיוק של מנתח החברות (26/10/2026): כל ערך מול כמה מקורות בלתי תלויים.
   טהור — בלי רשת. tools/fund-xcheck.js מביא את המקורות ומריץ.
   המקורות: (1) SEC גולמי — אותה תגית, ההגשה האחרונה, חישוב נפרד ופשוט של הרבעון (שנה פחות 9 חודשים);
   (2) הדוח כפי שהודפס (faceCheck — הסימון 'face' ב־checks); (3) Yahoo; (4) Nasdaq (EDGAR Online).
   הכרעה לכל ערך:
     ok   — תואם את כל המקורות שיש;
     def  — תואם את SEC (גולמי / מודפס), ואחד המקורות החיצוניים שונה — הגדרה אחרת אצלו (לא טעות שלנו);
     ext  — שני המקורות החיצוניים מסכימים זה עם זה ושונים מאיתנו, ואנחנו = SEC — לבדוק את בחירת התגית;
     bug  — שונה מ־SEC הגולמי של אותה תגית (טעות בחישוב שלנו), או שהדוח המודפס שונה;
     one  — רק מקור אחד, ושונה — לבדוק. */

const DAY = 864e5;
const day = (e) => Date.parse(e + 'T00:00:00Z') / DAY;
const nearEnd = (list, e, tol = 20) => { let b = -1, bd = 1e9; (list || []).forEach((x, i) => { const d = Math.abs(day(x) - day(e)); if (d < bd) { bd = d; b = i; } }); return bd <= tol ? b : -1; };

const PER_SHARE = new Set(['eps', 'dps']);
const NOSUM = new Set(['eps', 'dps', 'sh']);
// סטייה מותרת: עיגול לאלפים/מיליונים בדוחות ובמקורות (0.5%), למניה — סנט; ערכים קטנים מאוד (מתחת ל־0.1% מההכנסות) — עד ‎$2M
function same(m, a, b, scale) {
  if (a == null || b == null) return null;
  if (PER_SHARE.has(m)) return Math.abs(a - b) <= 0.011 + 0.002 * Math.abs(b);
  const d = Math.abs(a - b), mx = Math.max(Math.abs(a), Math.abs(b));
  return d <= 0.005 * mx || d <= Math.max(2e6, 1e-3 * (scale || 0));
}

/* ---------- Nasdaq: api.nasdaq.com/api/company/<SYM>/financials?frequency=1|2 (ערכים באלפים) ---------- */
const NQ_ROWS = {
  incomeStatementTable: { 'Total Revenue': 'rev', 'Cost of Revenue': 'cogs', 'Gross Profit': 'gp', 'Research and Development': 'rnd', 'Operating Income': 'op',
    'Earnings Before Tax': 'pretax', 'Income Tax': 'tax', 'Net Income': 'ni', 'Net Income Applicable to Common Shareholders': 'nic' },
  balanceSheetTable: { 'Cash and Cash Equivalents': 'cash', 'Total Current Assets': 'ca', 'Total Assets': 'ta', 'Total Current Liabilities': 'cl', 'Total Liabilities': 'tl',
    'Stock Holders Equity': 'eq', 'Retained Earnings': 're', 'Fixed Assets': 'ppe' },
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

/* ---------- SEC גולמי: אותה תגית, חישוב נפרד ---------- */
// companyfacts → לכל תקופה (start|end או end) הערך מההגשה האחרונה (10-K/10-Q/20-F/40-F ותיקוניהם)
const FORMS = /^(10-K|10-Q|20-F|40-F|10-KT|10-QT)(\/A)?$/;
function rawSeries(facts, tag) {
  if (!facts || !tag || /\+/.test(tag)) return null;
  for (const ns of ['us-gaap', 'ifrs-full']) {
    const g = facts.facts && facts.facts[ns] && facts.facts[ns][tag]; if (!g) continue;
    const dur = new Map(), inst = new Map();
    for (const rows of Object.values(g.units || {})) for (const x of rows) {
      if (!FORMS.test(x.form || '') || x.val == null) continue;
      const key = x.start ? x.start + '|' + x.end : x.end, M = x.start ? dur : inst, h = M.get(key);
      if (!h || x.filed > h.filed) M.set(key, { v: x.val, filed: x.filed });
    }
    return { dur, inst };
  }
  return null;
}
// ערך לתקופה: שנה (s..e ‏~365), רבעון — ישיר (~91) או מצטבר שנה פחות מצטבר קודם (חישוב משלו, בלי לגעת בקוד של השרתון)
function rawAt(rs, e, kind, fyStart) {
  if (!rs) return null;
  if (rs.inst.size && !rs.dur.size) { for (const [k, h] of rs.inst) if (Math.abs(day(k) - day(e)) <= 3) return h.v; return null; }
  const want = kind === 'A' ? [350, 380] : [80, 100];
  let best = null;
  for (const [k, h] of rs.dur) {
    const [s, en] = k.split('|'); if (Math.abs(day(en) - day(e)) > 3) continue;
    const L = day(en) - day(s); if (L >= want[0] && L <= want[1] && (!best || h.filed > best.filed)) best = h;
  }
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
  return cum != null && prev ? cum - prev.v : null;
}

/* ---------- ההשוואה ---------- */
const XK = ['rev', 'gp', 'op', 'ni', 'eps', 'sh', 'ocf', 'capex', 'cash', 'ta', 'tl', 'eq', 'ca', 'cl'];
const BAL = new Set(['cash', 'ta', 'tl', 'eq', 'ca', 'cl']);
const YK = { ni: 'ni' }; // Yahoo: NetIncomeCommonStockholders — מול nic כשיש
/* d = תשובת fundamentals (src sec), facts = companyfacts, y = parseYahooTs, nq = { A: parseNasdaq(שנתי), Q: parseNasdaq(רבעוני) }
   מחזיר רשימת ערכים: { m, k:'A'|'Q', p, v, raw, y, n, face, c } — c = ההכרעה */
function xcheck(d, facts, y, nq, opt = {}) {
  const out = [];
  if (!d || !d.ok || !d.tags) return out;
  const nA = opt.nA || 5, nQ = opt.nQ || 8;
  const faceBad = new Set((d.checks || []).filter((c) => c.k === 'face').map((c) => c.m + '|' + c.p));
  const fyS = (e) => { const i = d.fy.indexOf(e); return i > 0 ? new Date((day(d.fy[i - 1]) + 1) * DAY).toISOString().slice(0, 10) : null; };
  const fyOf = (qe) => d.fy.find((e) => day(e) >= day(qe) - 1 && day(e) - day(qe) < 366);
  const scaleA = (i) => Math.abs((d.A.rev && d.A.rev[i]) || 0);
  for (const kind of ['A', 'Q']) {
    const ends = kind === 'A' ? d.fy : d.q, D = kind === 'A' ? d.A : d.Q;
    const from = Math.max(0, ends.length - (kind === 'A' ? nA : nQ));
    for (const m of XK) {
      if (!D[m]) continue;
      const tag = d.tags[m], rs = rawSeries(facts, tag);
      for (let i = from; i < ends.length; i++) {
        const e = ends[i];
        let v = D[m][i]; if (v == null) continue;
        if (m === 'ni' && D.nic && D.nic[i] != null) v = { v, c: D.nic[i] }; // רווח לבעלי המניות — מול Yahoo/Nasdaq
        const vv = typeof v === 'object' ? v.v : v, vc = typeof v === 'object' ? v.c : v;
        const sc = kind === 'A' ? scaleA(i) : scaleA(d.fy.length - 1) / 4;
        let raw = null;
        if (rs) {
          // רווח למניה וממוצע מניות לא מצטברים — רק ערך ישיר (בלי שנה פחות 9 חודשים)
          const fs = kind === 'A' || BAL.has(m) || NOSUM.has(m) ? null : fyS(fyOf(e)) || null;
          raw = rawAt(rs, e, kind, fs);
          if (raw != null && (m === 'capex') ) raw = Math.abs(raw);
        }
        const yi = y && nearEnd(kind === 'A' ? y.fy : y.q, e, 20), ys = y && (kind === 'A' ? y.A : y.Q);
        const yv = yi >= 0 && ys && ys[YK[m] || m] ? ys[YK[m] || m][yi] : null;
        const N = nq && nq[kind], ni = N ? nearEnd(N.ends, e, 20) : -1;
        const nk = m === 'ni' ? 'nic' : m;
        const nv = ni >= 0 && N.v[nk] ? N.v[nk][N.ends[ni]] ?? null : null;
        const face = faceBad.has(m + '|' + e) ? false : null;
        const r = { m, k: kind, p: e, v: vv, raw, y: yv, n: nv, face, der: !!(d.derived && d.derived[m] && d.derived[m].includes(e)) };
        const sr = same(m, vv, raw, sc), sy = same(m, vc, yv, sc), sn = same(m, vc, nv, sc), yn = same(m, yv, nv, sc);
        // מספר מניות שהחברה הגישה בקנה מידה שגוי ותוקן אצלנו (fixes) — SEC הגולמי פי אלף / מיליון קטן
        const fixd = sr === false && m === 'sh' && raw > 0 && [1e3, 1e6].some((f) => Math.abs(vv / raw / f - 1) < 0.02);
        if (fixd) r.c = sy === false || sn === false ? 'one' : 'fix';
        else if (sr === false || face === false) r.c = 'bug';
        else if (sy !== false && sn !== false) r.c = sy == null && sn == null && sr == null ? 'none' : 'ok';
        else if (sy === false && sn === false && yn === true) r.c = sr === true ? 'ext' : 'one';
        else if (sr === true) r.c = 'def';
        else r.c = 'one';
        out.push(r);
      }
    }
  }
  return out;
}

/* סיכום: לכל הכרעה, לכל מדד ולכל חברה */
function summarizeX(rows) {
  const S = { n: 0, c: {}, byM: {}, cos: {} };
  for (const { sym, x } of rows) {
    for (const r of x) {
      S.n++; S.c[r.c] = (S.c[r.c] || 0) + 1;
      const b = (S.byM[r.k + ':' + r.m] = S.byM[r.k + ':' + r.m] || {}); b[r.c] = (b[r.c] || 0) + 1;
      if (r.c === 'bug' || r.c === 'ext' || r.c === 'one') (S.cos[sym] = S.cos[sym] || []).push(r);
    }
  }
  return S;
}

module.exports = { xcheck, summarizeX, parseNasdaq, rawSeries, rawAt, same, XK };
