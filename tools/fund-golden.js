#!/usr/bin/env node
/* בונה את סט הזהב (ibkr-proxy/lib/golden.json) — שכבה 4 בבקרת הדיוק של מנתח החברות.
   המקור: הדוח השנתי האחרון של כל חברה כפי שהודפס (דפי R של EDGAR), והשורה נבחרת לפי **הכותרת שהחברה כתבה**
   ("Total revenues", "Net income", "Total assets"…) — לא לפי התגיות, כך שזו בדיקה בלתי תלויה של בחירת התגיות שלנו.
   מדפיס טבלה לבדיקה בעין; כותב רק עם --write. אחרי שנכתב — הסט קפוא: fund-audit.js נכשל כשמספר בו זז.
   שימוש: node tools/fund-golden.js [--syms A,B] [--write] */
const fs = require('fs');
const path = require('path');
const F = require('../ibkr-proxy/lib/fundamentals.js');
const SF = require('../ibkr-proxy/lib/secface.js');

// 30 חברות מכל הענפים (טכנולוגיה, פיננסים, צריכה, תעשייה, אנרגיה, בריאות, תקשורת, נדל״ן) — כולל המקרים הקשים שנמצאו
const DEF = 'AAPL,MSFT,GOOGL,AMZN,META,NVDA,MA,V,JPM,AXP,BAC,BRK-B,PG,KO,MCD,WMT,COST,NKE,CAT,GE,BA,XOM,CVX,JNJ,PFE,UNH,T,VZ,O,ADBE';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const syms = arg('syms', DEF).split(',');

// כותרות שורה (מהדוח עצמו) → מדד. הראשונה שמתאימה בדוח הנכון. סדר = עדיפות.
const LABELS = {
  rev: ['is', [/^total (net )?revenues?(,? net of interest expense)?$/i, /^revenues?,? net$/i, /^net revenues?$/i, /^total net sales$/i, /^net sales$/i,
    /^total (net )?operating revenues?$/i, /^net operating revenues?$/i, /^total revenues and other income$/i, /^total sales and revenues$/i, /^sales to customers$/i,
    /^(total )?revenues?$/i, /^total net revenue$/i, /^operating revenues?$/i]],
  // לבעלי המניות של החברה (לא זכויות מיעוט, לא "לבעלי המניות הרגילות" אחרי דיבידנד בכורה); ואם אין — השורה הכללית
  ni: ['is', [/^(consolidated )?net (income|earnings)(\s*\/?\s*\(?loss\)?)? attributable to (?!.*(noncontrolling|common|non-controlling))[a-z .,&'’-]+$/i,
    /^profit attributable to common (stock|share)holders$/i, /^net (income|earnings) attributable to [a-z .,&'’-]+ common (share|stock)holders$/i,
    /^(consolidated )?net (income|earnings)( \(loss\)|\/\(loss\))?$/i, /^profit( \(loss\))?$/i]],
  // רווח למניה מדולל — רק שורה שהיא באמת "למניה" (התגית רק ליחידות), והכותרת אומרת diluted
  eps: ['is', [/diluted/i], (r) => /PerShare|PerDilutedShare/.test(r.tag) && !/Continuing|Discontinued/.test(r.tag)],
  // כשהכותרת לא אומרת "diluted" (Pfizer, Verizon) — השורה שהתגית שלה מדוללת; ושם רק לבדוק שהיא "למניה"
  eps2: ['is', [/./], (r) => r.tag === 'EarningsPerShareDiluted'],
  ocf: ['cf', [/^net cash (provided|generated) (by|from)( \(used (in|for)\))?( \/ \(used in\))? operating activities$/i, /^net cash (provided by|from) \(used (in|for)\) operating activities$/i,
    /^net cash \((used in|used for)\)\/?provided by operating activities$/i, /^net cash (\(used in\)\/provided by|provided\/\(used\) by|provided by \/ \(used in\)|provided by\/\(used in\)) operating activities$/i,
    /^net cash flows? (provided by |from )operating activities$/i, /^cash (generated|provided) by operating activities$/i, /^cash flows from operating activities$/i,
    /^total operating activities$/i, /^cash provided( \(used\))? by operations$/i, /^net cash from operations$/i, /^cash from \(used for\) operating activities$/i, /^net cash provided by \(used for\) operating activities$/i]],
  ta: ['bs', [/^total assets$/i]],
};

(async () => {
  const map = await F.cikMap(), out = {}, H = { headers: { 'User-Agent': process.env.SEC_UA || 'TheSnowball/1.0 data@thesnowball.app' } };
  for (const sym of syms) {
    const cik = map.get(F.secSym(sym));
    if (!cik) { console.log(sym, 'אין CIK'); continue; }
    const sub = await (await fetch('https://data.sec.gov/submissions/CIK' + cik + '.json', H)).json();
    let face = await F.secFace(cik, sub);
    if (!face && F.CIK_PREV[cik]) face = await F.secFace(F.CIK_PREV[cik], await (await fetch('https://data.sec.gov/submissions/CIK' + F.CIK_PREV[cik] + '.json', H)).json());
    if (!face) { console.log(sym, 'אין דוח'); continue; }
    const v = {}, lines = [];
    for (const [k, [st, res]] of Object.entries(LABELS)) {
      const S = face[st]; if (!S) continue;
      let row = null;
      const okRow = LABELS[k][2] || (() => true), lab = (r) => r.label.replace(/\d+$/, '').replace(/\s*\((in|usd|\$)[^)]*\)\s*$/i, '').replace(/[–—]/g, '-').trim();
      for (const re of res) { row = S.rows.find((r) => okRow(r) && (re.test(lab(r)) || re.test(r.label))); if (row) break; }
      if (!row) { lines.push(`  ${k}: לא נמצאה שורה`); continue; }
      const vals = SF.rowVals(S, row), byYear = {};
      S.cols.forEach((c, i) => { if (vals[i] == null || (st !== 'bs' && c.months != null && c.months !== 12)) return; byYear[c.end] = vals[i]; });
      const key = k === 'eps2' ? 'eps' : k;
      if (key === 'eps' && v.eps) continue;
      if (Object.keys(byYear).length) { v[key] = byYear; lines.push(`  ${k}: "${row.label}" [${row.tag}] ${JSON.stringify(byYear)}`); }
    }
    out[sym] = { acc: face.acc, filed: face.filed, form: face.form, v };
    console.log(sym, face.form, face.filed); console.log(lines.join('\n'));
    await new Promise((z) => setTimeout(z, 250));
  }
  if (process.argv.includes('--write')) {
    const p = path.join(__dirname, '../ibkr-proxy/lib/golden.json');
    fs.writeFileSync(p, JSON.stringify({ v: 1, built: new Date().toISOString().slice(0, 10),
      note: 'סט הזהב — ערכים מהדוח השנתי כפי שהודפס, לפי כותרת השורה. נבדק בעין. tools/fund-golden.js בונה, tools/fund-audit.js בודק.', companies: out }, null, 1) + '\n');
    console.log('נכתב', p);
  }
})();
