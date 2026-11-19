/* הרבעון הרביעי מההודעה לעיתונות (17/11/2026, בדיקת העומק של מנתח החברות — גל 2, F2; ‏docs/research/fund-deep/wave-2.md).
   מאז 2021 ה־10-K לא מדפיס את הרבעון הרביעי, ו־XBRL לא מתייג אותו — ממוצע המניות המדולל של הרבעון הוערך (4 × השנה פחות
   שלושה רבעונים), ומכאן שגיאה של סנט־שניים ברווח למניה. מקור מודפס: ההודעה על התוצאות (8-K, ‏Item 2.02, ‏EX-99.1) —
   טבלת דוח הרווח וההפסד של "שלושה חודשים" — שורות "Diluted" (רווח למניה ומניות). מידע ציבורי של SEC בלבד.
   · pickItems — ה־8-K של התוצאות השנתיות: Item 2.02, הראשון אחרי סוף השנה (עד 100 יום)
   · exhibits  — המועמדים בתיקיית ההגשה (index.json): ‏htm שאינו המסמך הראשי, EX-99 קודם
   · parse     — שורות הטבלה שהתווית שלהן "dilut…": {label, v:[מספרים|null]} — העמודות כפי שהודפסו (בלי עמודות "$")
   · q4From    — הזוג (רווח למניה, מניות) מאותה עמודה שמכפלתם = הרווח של הרבעון שלנו, והמניות ליד ההערכה שלנו */
'use strict';

// גל 8: גם מספר בלי אפס מוביל — ".45" (KeyCorp: ‏".28", ‏".23" נבלעו בתווית, והעמודות זזו)
const num = (s) => {
  const t = String(s).replace(/[\s$€£,]/g, '').replace(/—|–/g, '-');
  if (/^[-]+$/.test(t)) return null; // "—" = אפס/ריק — שומר על מיקום העמודה
  const m = /^(\()?(-)?(\d+(?:\.\d+)?|\.\d+)\)?%?$/.exec(t);
  if (!m) return undefined;
  const v = +m[3];
  return m[1] || m[2] ? -v : v;
};
const SH_ROW = /weighted|average (number of )?(common )?shares|shares outstanding/i; // תווית של ממוצע מניות (F36)
const OPEN = /^[$€£]?\s*\(\s*[$€£]?$/; // תא / מילה שהם רק סוגר פותח (עם סימן מטבע): "(", ‏"($", ‏"$("
const text = (h) => String(h).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
  .replace(/&amp;/g, '&').replace(/&#8212;|&#x2014;|&mdash;/gi, '—').replace(/&#8211;|&#x2013;|&ndash;/gi, '–')
  .replace(/&#\d+;|&\w+;/g, ' ').replace(/\s+/g, ' ').trim();

/* שורות "מדולל" בכל הטבלאות. כל שורה: תווית + ערכים מספריים לפי הסדר (עמודות "$" ו־")" נפרדות מתאחדות).
   want — מסנן אחר לתווית (parseEps); בלעדיו "dilut" בתווית או בכותרת שמעליה */
function parse(html, want) {
  const out = [];
  const tables = String(html).split(/<table/i).slice(1);
  tables.forEach((tb, ti) => {
    const body = tb.split(/<\/table>/i)[0];
    let ctx = '', prev = null;
    for (const tr of body.split(/<tr/i).slice(1)) {
      const cells = (tr.match(/<t[dh][^>]*>[\s\S]*?(?=<t[dh][\s>]|<\/tr>|$)/gi) || []).map(text).filter((c) => c && c !== '$' && c !== ')' && c !== '%');
      if (!cells.length) continue;
      const lab = [], v = [];
      // גל 8: סוגר פותח בתא משלו — "($" / "(" ואחריו "0.26" ו־")" (FedEx): המספר שלילי. עד היום הסימן אבד (‏+0.26 במקום ‏−0.26)
      let neg = false;
      for (const c of cells) {
        if (OPEN.test(c)) { neg = true; continue; }
        const n = num(c);
        if (n === undefined && !v.length) lab.push(c); else if (n !== undefined) v.push(neg && n > 0 ? -n : n);
        neg = false;
      }
      const label = lab.join(' ');
      if (!v.length) { if (label) ctx = label.slice(0, 80); continue; }
      // גל 8 (F36): שורת מניות בלי "מדולל" מיד אחרי שורת "Diluted" של רווח למניה — המניות המדוללות (Dollar Tree: ‏"Basic" ‏/
      // ‏"Weighted average number of shares" ‏/ ‏"Diluted" ‏/ ‏"Weighted average number of shares"). השורה שאחרי "Basic" — לא
      const p0 = prev; prev = label;
      const after = !want && !!p0 && /dilut/i.test(p0) && !/per share|earnings|income|loss/i.test(label) && SH_ROW.test(label) && !/basic|dilut/i.test(label);
      if (want ? !want(label) : !/dilut/i.test(label) && !/dilut/i.test(ctx) && !after) continue;
      if (!v.some((x) => x != null)) continue;
      out.push(want ? { t: ti, label: label.slice(0, 80), ctx: '', v, b: 1 } : { t: ti, label: label.slice(0, 80), ctx: /dilut/i.test(label) ? '' : after && !/dilut/i.test(ctx) ? p0.slice(0, 80) : ctx, v });
      if (out.length >= 40) return;
    }
  });
  return out;
}

/* מסמך בלי טבלאות (18/11/2026, גל 5 — F24): מצגת שקפים עם שכבת טקסט (Apollo), HTML שהומר מ־PDF (Ameriprise, ‏AppLovin), מכתב
   לבעלי המניות — "Diluted" והמספרים ברצף טקסט, ו־parse לא מוצא שורה. רצף המילים מתחלק לשורות: תווית = המילים מאז רצף המספרים
   הקודם, ערכים = רצף המספרים שאחריה. רק כש־parse ריק; כל השורות באותה "טבלה" — q4From מאמת (מכפלה = הרווח, מניות ליד ההערכה) */
function parseText(html) {
  const words = String(html).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/&amp;/g, '&').replace(/&#8212;|&#x2014;|&mdash;/gi, '—').replace(/&#8211;|&#x2013;|&ndash;/gi, '–').replace(/&#\d+;|&\w+;/g, ' ').split(/\s+/);
  const out = [];
  let lab = [], v = [], neg = false;
  const flush = () => {
    const label = lab.slice(-12).join(' ');
    if (v.length && /dilut/i.test(label) && v.some((x) => x != null)) out.push({ t: 0, label: label.slice(0, 80), ctx: '', v });
    lab = []; v = [];
  };
  for (const w0 of words) {
    if (out.length >= 40) break;
    const w = w0.replace(/[.,;:]+$/, '');
    if (!w || w === '$' || w === ')' || /%\)?$/.test(w)) continue; // אחוז שינוי — לא עמודה
    if (OPEN.test(w)) { neg = true; continue; } // "($ 0.26)" ברצף הטקסט (גל 8)
    if (/^[-–—]+$/.test(w)) { neg = false; if (v.length) v.push(null); else lab.push(w); continue; } // מקף בתווית ("Stockholders - Diluted") / תא ריק
    const n = num(w), ng = neg; neg = false;
    if (n == null) { if (v.length) flush(); lab.push(w); continue; }
    if (!v.length && /^\(\d\)$/.test(w)) continue; // הערת שוליים אחרי התווית: "(2)"
    v.push(ng && n > 0 ? -n : n);
  }
  flush();
  return out;
}

/* רווח למניה בלי המילה "מדולל" (18/11/2026, גל 6 — F30): חברות חשמל ואחרות מדפיסות "Net income per share" / "GAAP Basic Earnings
   Per Share" ו־"Weighted average shares" (Fox, ‏Loews, ‏NiSource). רק כש־parse ו־parseText לא מצאו שורת "מדולל", והשורות מסומנות b —
   q4Press מקבל אותן רק בשנה שבה המניות הבסיסיות = המדוללות בדוח השנתי (noDil), כך שאין הבדל בין השניים. רק התווית עצמה (לא כותרת
   כמו "except per share data"); רווח מתואם, דיבידנד והון למניה — לא */
const EPS_L = /per (common )?share|earnings per|\beps\b/i, EPS_X = /except|in (millions|thousands)|dividend|book value|adjust|non-gaap|operating|excluding|pro forma|guidance|outlook|cash flow|distribut/i;
const SH_L = /weighted|average (common |number of )?shares|average common shares|shares outstanding/i;
const parseEps = (html) => parse(html, (l) => (EPS_L.test(l) && !EPS_X.test(l)) || (SH_L.test(l) && !EPS_L.test(l)));

/* 8-K רק עם 7.01 / ‏8.01 / ‏9.01 — מועמד חלופי (F25) */
const ALT = /^\s*(7\.01|8\.01|9\.01)(\s*,\s*(7\.01|8\.01|9\.01))*\s*$/;

/* ה־8-K של התוצאות לכל סוף שנה: Item 2.02, הראשון שהוגש אחרי סוף השנה ועד 100 יום */
function pickItems(sub, fyEnds) {
  const r = sub && sub.filings && sub.filings.recent;
  if (!r || !r.form) return [];
  const day = (s) => Date.parse(s + 'T00:00:00Z') / 864e5;
  // בלי Item 2.02 (גל 5, F25): ההודעה הוגשה רק עם 9.01 / ‏7.01 / ‏8.01 (Illinois Tool Works ‏2021, ‏Lilly ‏2015, ‏Expedia ‏2021) —
  // כשאין 8-K של תוצאות בחלון, אלה מועמדים עד 75 יום (q4From מאמת: מכפלה = הרווח, מניות ליד ההערכה)
  const ks = [], alt = [];
  for (let i = 0; i < r.form.length; i++) {
    const k = { acc: r.accessionNumber[i], filed: r.filingDate[i], doc: r.primaryDocument[i] };
    if (/^8-K/.test(r.form[i]) && /2\.02/.test(r.items[i] || '')) ks.push(k);
    else if (r.form[i] === '8-K' && ALT.test(r.items[i] || '')) alt.push(k);
  }
  const out = [];
  const by = (a, b) => (a.filed < b.filed ? -1 : 1);
  for (const e of fyEnds) {
    // כמה מועמדים — הראשון שיש בו שורות "מדולל" (Southwest: ‏8-K של נתוני תנועה בינואר, וההודעה על התוצאות אחריו)
    let c = ks.filter((k) => day(k.filed) > day(e) && day(k.filed) - day(e) <= 100).sort(by);
    if (!c.length) c = alt.filter((k) => day(k.filed) > day(e) && day(k.filed) - day(e) <= 75).sort(by);
    if (c.length) out.push({ end: e, cands: c.slice(0, 3) });
  }
  return out;
}

/* המועמדים בתיקיית ההגשה: ‏htm, לא המסמך הראשי ולא דפי R; ‏EX-99 קודם, אחר כך לפי גודל */
function exhibits(index, doc) {
  const it = (index && index.directory && index.directory.item) || [];
  return it.filter((x) => /\.htm$/i.test(x.name) && x.name !== doc && !/^R\d+\.htm$/i.test(x.name) && !/index/i.test(x.name))
    .map((x) => ({ name: x.name, n: +x.size || 0, ex: /ex[-_]?99|exhibit99|ex99/i.test(x.name) ? (/99[-_.]?0?1(?!\d)/.test(x.name) ? 2 : 1) : 0 }))
    .sort((a, b) => b.ex - a.ex || b.n - a.n).map((x) => x.name);
}

/* (רווח למניה, מניות) של הרבעון מאותה עמודה ומאותה טבלה: מכפלה = הרווח שבבסיס הרווח למניה (עד העיגול לסנט + 1%),
   והמניות (אחרי קנה מידה 1 / אלף / מיליון) עד 10% מההערכה שלנו. ni — הרווח של הרבעון (דולרים), est — ההערכה (מניות),
   post — מקדמי הפיצול האפשריים (מספר או מערך; Apple ‏4:1 ב־2020: ההודעה של 2019 — 4.65 מיליארד מניות, אצלנו 18.6. תאריך
   הפיצול אצלנו הוא לפעמים ההגשה הראשונה אחריו, לא היום עצמו — לכן כל המקדמים, והמכפלה והקרבה להערכה בוחרות). אורך השורות יכול להיות
   שונה (עמודת "שינוי ב־%" עם "n/m" נשמטת רק בשורה אחת — Southwest) — העמודה של הרבעון היא בדרך כלל הראשונה, והמכפלה מאמתת */
/* ann — {ni:[…], sh} של השנה: כשעמודה אחרת באותן שורות היא השנה שלנו (מניות עד 2%, מכפלה עד 2%) — הטבלה אומתה, והמניות
   של הרבעון יכולות להיות עד 25% מההערכה (TransDigm 2020: ההערכה ‏67.7M, בהודעה ‏57.3M — רבעונים עם דיבידנד מיוחד) */
function q4From(rows, ni, est, post, ann) {
  const pfs = [...new Set([1].concat(post == null ? [] : post).filter((x) => x > 0))];
  if (!rows || !rows.length || !(est > 0) || !Number.isFinite(ni)) return null;
  let best = null;
  const isEps = (r) => r.v.every((x) => x == null || Math.abs(x) < 5000) && r.v.some((x) => x != null && Math.round(x) !== x);
  for (const re of rows) {
    if (!isEps(re)) continue;
    for (const rs of rows) {
      if (rs === re || rs.t !== re.t) continue;
      for (let i = 0; i < Math.min(re.v.length, rs.v.length); i++) for (const pf of pfs) {
        const e = re.v[i] / pf, s0 = rs.v[i] * pf;
        if (re.v[i] == null) continue;
        if (e == null || !(s0 > 0)) continue;
        for (const f of [1, 1e3, 1e6]) {
          const s = s0 * f;
          const dv = Math.abs(s / est - 1);
          if (dv > 0.25 || (dv > 0.1 && !annOk(re, rs, i, f, pf, ann))) continue;
          const err = Math.abs(e * s - ni), tol = 0.0051 * s + 0.02 * Math.abs(ni);
          if (err > tol) continue;
          const sc = err / (tol || 1) + Math.abs(s / est - 1);
          if (!best || sc < best.sc) best = { eps: Math.round(e * 1e4) / 1e4, sh: s, sc, i, row: rs.v.map((x) => (x == null ? null : x * f * pf)) };
        }
      }
    }
  }
  return best && { eps: best.eps, sh: best.sh, col: best.i, row: best.row }; // row — שורת המניות כולה (בקנה המידה שלנו), לבדיקת הבסיס בשנה
}

const annOk = (re, rs, i, f, pf, ann) => !!ann && ann.sh > 0 && re.v.some((e0, j) => {
  if (j === i || e0 == null || !(rs.v[j] > 0)) return false;
  const s = rs.v[j] * f * pf, e = e0 / pf;
  return Math.abs(s / ann.sh - 1) <= 0.02 && (ann.ni || []).some((n) => Number.isFinite(n) && Math.abs(e * s - n) <= 0.0051 * s + 0.02 * Math.abs(n));
});

/* שורת מניות (לא רווח למניה): תווית של מניות / ממוצע, או ערך של אלף ומעלה */
const isShares = (r) => (/share|weight|average|outstanding/i.test(r.label + ' ' + (r.ctx || '')) && !/per (common )?share|earnings per|income per|loss per|\beps\b/i.test(r.label))
  || r.v.some((x) => x != null && Math.abs(x) >= 1000);

/* שורה ש־q4From יכול להשתמש בה כמניות (גל 6, F31 — ההחלטה אם להמשיך למועמד הבא): תווית של מניות, או שורה שאינה רווח למניה
   ואינה רק שנים ("2028" בתחזית — Ecolab ‏2025). isShares לבדו גם החמיץ שורת מניות אמיתית וגם ספר שנה */
const yearsOnly = (r) => r.v.every((x) => x == null || (Number.isInteger(x) && x >= 1990 && x <= 2100));
const epsLike = (r) => r.v.every((x) => x == null || Math.abs(x) < 5000) && r.v.some((x) => x != null && Math.round(x) !== x);
const shLab = (r) => /share|weight|average|outstanding/i.test(r.label + ' ' + (r.ctx || '')) && !/per (common )?share|earnings per|income per|loss per|\beps\b/i.test(r.label);
const shRow = (r) => !yearsOnly(r) && (shLab(r) || !epsLike(r));

module.exports = { shRow, parse, parseText, parseEps, pickItems, ALT, exhibits, q4From, isShares, num };
