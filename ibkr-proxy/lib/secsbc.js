/* האם הרווח המותאם מוציא את התגמול במניות (18/11/2026, בקשת המשתמש — "מכפיל באפט"; docs/buffett-pe.md).
   "רווח הרחוב" (Yahoo, האנליסטים) הוא הרווח המותאם של החברה כשהיא מפרסמת כזה. חלק מהחברות מוציאות ממנו את התגמול במניות
   (רוב חברות התוכנה), וחלק לא (תרופות, תעשייה, צריכה). ב־2026 חברות גדולות עברו לכלול אותו (NVDA מתחילת שנת הכספים 2027, INTU
   הודיעה שתעבור) — לכן לא מניחים לפי ענף, אלא קוראים את ההודעה לעיתונות של כל רבעון (8-K ‏Item 2.02 ← EX-99). מידע ציבורי של SEC בלבד.
   · classify(text) — {ex, fut, er, h}: ex — הרווח המותאם למניה בהודעה הזו מוציא את התגמול; fut — גם מעכשיו והלאה ("will no longer
     exclude" = לא); er — זו הודעת תוצאות (רווח מדולל + רבעון); h — סימני ההחלטה (לבדיקה)
   · pick(sub, now) — ה־8-K עם 2.02 מ־15 החודשים האחרונים, החדש קודם (עד MAX)
   · readOne(cik, k, getText) — index.json ← עד 2 נספחים (EX-99 קודם; בלי נספח — המסמך הראשי) ← classify. null = תקלת רשת (ינוסה שוב) */
'use strict';
const SECPR = require('./secpr');

const SV = 1;          // גרסת המסווג — שינוי בכללים = מספר חדש, וההודעות נקראות מחדש
const MAX = 6;         // הודעות אחרונות (4 רבעוני ה־12 חודשים + מרווח להודעה מקדימה)
const DAYS = 460;

const text = (h) => String(h).slice(0, 2e6).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
  .replace(/&#8217;|&#x2019;|&rsquo;/gi, "'").replace(/&#8211;|&#8212;|&#x2013;|&#x2014;|&mdash;|&ndash;/gi, '-').replace(/&amp;/g, '&')
  .replace(/&#\d+;|&#x[0-9a-f]+;|&\w+;/gi, ' ').replace(/\s+/g, ' ').toLowerCase();

// שורת התגמול. "excess" / "settlement of" / "incremental" — פריט מס או חד־פעמי (CAT, ‏WMT), לא התגמול השוטף
const SBC = /(?:stock|share|equity)[- ]?based(?: and deferred)? compensation|stock compensation|share-based payments?|equity compensation/g;
const SKIP_PRE = /(?:excess|settlement of|exercise of|incremental(?: non-cash)?|accelerated|one-time|tax benefits? (?:from|on|related to))\s*$/;
const SKIP_POST = /compensation awards? (?:with|using)|tax (?:benefit|deduction)/;
// המשך במילים (הערת שוליים או משפט, לא שורה בטבלה): PYPL "…compensation expense associated with restructuring", ‏WMT "…payment
// plans in anticipation…", ‏HON "…stock compensation expense, pension…", ‏UBER "…compensation expenses. 11". "net of tax" — שורה (TSLA)
const PROSE = /^(?:\s*expenses?)?\s*(?:associated|in anticipation|which|that|is|was|were|has|have|had|primarily|relates?|related to|of|for|from|plans?|as a percentage)\b|^[^\d(]{0,25}\.\s|^(?:\s*expenses?)?\s*,\s*(?!net of tax)[a-z]/;
// שורה עם מספרים מיד אחריה (ABNB: שורה בטבלת EBITDA — לא "תיאור במילים")
const NUMROW = /^(?:\s*expenses?\d?)?\s*(?:\(\d\)\s*)?(?:\$\s*)?(?:\(?\d|-\s|—)/;
// היעד של טבלת ההתאמה: השורה הראשונה מהסוגים האלה אחרי שורת התגמול
const TGT = /(?:non-gaap|adjusted|core|cash)\s+(?:diluted\s+)?(?:net income|net earnings|earnings per (?:diluted )?share|eps|(?:diluted )?(?:net )?(?:income|earnings|profit) per (?:diluted |common )?share|net income per (?:diluted )?share|net income attributable)/;
const OTHER = /(?:non-gaap|adjusted)\s+(?:operating (?:income|expenses?|margin|profit)|gross (?:profit|margin)|ebitda|ebit\b|free cash flow|segment)|segment (?:profit|operating income)|ebitda|operating activities|cash flows? from|effective (?:income )?tax rate|tax rate/;
// דוח תזרים המזומנים (MSFT, ‏DIS) מול טבלת התאמה — מה הופיע אחרון לפני השורה
const CF = /operating activities|cash provided by|cash flows? (?:from|provided)|net cash/g;
const REC = /reconcil|non-gaap|adjusted|as reported|\bgaap\b/g;
// "no longer exclude" / "does not exclude" (NVDA); עם "will" לפני — רק מכאן והלאה (INTU)
const NEG = /(?:no longer|not|n't)\s+(?:\w+\s+){0,3}exclud\w*\s+(?:\w+\s+){0,6}?(?:stock|share|equity)[- ]?based/g;
const ER_Q = /(?:three|thirteen|twelve|fourteen|sixteen|six|nine) (?:months|weeks) ended|quarter ended|(?:first|second|third|fourth)[- ]quarter|\bq[1-4]\b/;

const lastOf = (s, re) => { let m, i = -1; re.lastIndex = 0; while ((m = re.exec(s))) i = m.index; return i; };

function classify(raw) {
  const t = raw && raw.length && /</.test(raw.slice(0, 2000)) ? text(raw) : String(raw || '').toLowerCase().replace(/\s+/g, ' ');
  // הודעת תוצאות: רבעון + רווח למניה (MRK ו־XOM לא כותבות "diluted")
  const er = ER_Q.test(t) && /diluted|earnings per (?:common )?share|\beps\b/.test(t) && /net (?:income|earnings|loss)|earnings per share|per share/.test(t);
  let nowNeg = false, futNeg = false, m;
  NEG.lastIndex = 0;
  while ((m = NEG.exec(t))) { if (/will\s+$/.test(t.slice(Math.max(0, m.index - 8), m.index))) futNeg = true; else nowNeg = true; }
  const hits = [];
  SBC.lastIndex = 0;
  while ((m = SBC.exec(t)) && hits.length < 200) {
    const i = m.index, pre = t.slice(Math.max(0, i - 40), i), post = t.slice(i, i + 60);
    if (SKIP_PRE.test(pre) || SKIP_POST.test(post)) { hits.push('x'); continue; }
    const back = t.slice(Math.max(0, i - 1500), i), inCf = lastOf(back, CF) > lastOf(back, REC);
    const after = t.slice(i + m[0].length, i + m[0].length + 1500), a = after.search(TGT), b = after.search(OTHER), prose = PROSE.test(after.slice(0, 60)), row = NUMROW.test(after.slice(0, 40));
    if (!prose && !inCf && a >= 0 && (b < 0 || a < b)) { hits.push('E'); continue; }
    // במילים: "non-GAAP net income / results / measures … exclude … stock-based compensation" — באותו משפט, לא על EBITDA בלבד (UBER, ‏IBM)
    const b350 = t.slice(Math.max(0, i - 350), i), s = b350.slice(b350.lastIndexOf('. ') + 1);
    if (!row && /non-gaap|adjusted/.test(s) && /exclud/.test(s) && !/ebitda/.test(s) && /net income|per share|\beps\b|earnings|results|measures|guidance/.test(s)) { hits.push('P'); continue; }
    hits.push(inCf ? 'c' : '-');
  }
  const ex = !nowNeg && hits.some((h) => h === 'E' || h === 'P');
  return { ex, fut: ex && !futNeg, er, n: t.length, h: (nowNeg ? 'N' : futNeg ? 'F' : '') + hits.join('').slice(0, 40) };
}

function pick(sub, now) {
  const r = sub && sub.filings && sub.filings.recent;
  if (!r || !r.form) return [];
  const lim = new Date((now || Date.now()) - DAYS * 864e5).toISOString().slice(0, 10), out = [];
  for (let i = 0; i < r.form.length && out.length < MAX; i++) {
    if (!/^8-K/.test(r.form[i]) || !/2\.02/.test(r.items[i] || '') || r.filingDate[i] < lim) continue;
    out.push({ acc: r.accessionNumber[i], filed: r.filingDate[i], doc: r.primaryDocument[i] });
  }
  return out;
}

async function readOne(cik, k, getText) {
  const base = 'https://www.sec.gov/Archives/edgar/data/' + (+cik) + '/' + k.acc.replace(/-/g, '') + '/';
  let idx;
  try { idx = JSON.parse(await getText(base + 'index.json')); } catch (e) { return /http_404/.test(String(e && e.message)) ? { filed: k.filed, er: false, ex: false, fut: false, h: '404', sv: SV } : null; }
  let names = SECPR.exhibits(idx, k.doc).slice(0, 2);
  if (!names.length && k.doc) names = [k.doc];
  let t = '';
  for (const nm of names) {
    try { t += ' ' + text(await getText(base + nm)); } catch (e) { if (!/http_404/.test(String(e && e.message))) return null; }
  }
  const c = classify(t);
  return { filed: k.filed, er: c.er, ex: c.ex, fut: c.fut, n: c.n, h: c.h, sv: SV };
}

/* לתשובה: [[תאריך הגשה, ex, fut, אורך], …] — רק הודעות תוצאות, מהישנה לחדשה. כמה הודעות לאותו רבעון (הודעה מקדימה, עדכון
   תחזית) — הלקוח בוחר את הארוכה, ההודעה המלאה */
const forClient = (sx) => Object.values(sx || {}).filter((r) => r && r.er && r.sv === SV).sort((a, b) => (a.filed < b.filed ? -1 : 1))
  .map((r) => [r.filed, r.ex ? 1 : 0, r.fut ? 1 : 0, r.n || 0]);

module.exports = { classify, pick, readOne, forClient, text, SV, MAX };
