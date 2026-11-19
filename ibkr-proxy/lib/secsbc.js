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

const SV = 3;          // גרסת המסווג — שינוי בכללים = מספר חדש, וההודעות נקראות מחדש (2: המשפט כולו בעדות במילים, 19/11/2026;
                       // 3: שיעור המס ה־non-GAAP שהחברה מצהירה ‏(tr), הסכום בשורת התגמול בגישור ‏(sa) וסוף הרבעון ‏(qe), גל 1 של שיטת באפט;
                       //    וגם B-025 ו־B-026 ‏(SKIP_PRE), ‏B-027 (מדדי מנהלות השקעות ב־TGT) ו־tb — המס המותאם כולל את הטבת המס)
const MAX = 6;         // הודעות אחרונות (4 רבעוני ה־12 חודשים + מרווח להודעה מקדימה)
const DAYS = 460;

const text = (h) => String(h).slice(0, 2e6).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
  .replace(/&#8217;|&#x2019;|&rsquo;/gi, "'").replace(/&#8211;|&#8212;|&#x2013;|&#x2014;|&mdash;|&ndash;/gi, '-').replace(/&amp;/g, '&')
  .replace(/&#\d+;|&#x[0-9a-f]+;|&\w+;/gi, ' ').replace(/\s+/g, ' ').toLowerCase();

// שורת התגמול. "excess" / "settlement of" / "incremental" — פריט מס או חד־פעמי (CAT, ‏WMT), לא התגמול השוטף
const SBC = /(?:stock|share|equity)[- ]?based(?: and deferred)? compensation|stock compensation|share-based payments?|equity compensation/g;
// "acquisition-related cash and share-based compensation costs" (Cardinal) — שורת רכישות, לא התגמול השוטף (§13.11: מטופל כחד־פעמי
// שחוזר, לא כאן); עד גרסה 3 נספרה כעדות, ו־Cardinal סומנה "מוציאה" אף שהרווח המותאם שלה כולל את התגמול הרגיל (B-025 בבדיקת
// העומק, docs/buffett-pe-audit.md: על 3,239 הודעות רק Cardinal מתהפכת). בלי "costs," — אצל Intel זו רשימה של פריטים נפרדים.
// שורת מס ומשפט מס — "income tax effect of share-based compensation", "the normalized tax benefit of share-based compensation"
// (Applied Materials, שכוללת את התגמול ברווח המותאם; B-026 — לפני גרסה 3 נספרו כעדות, ו־AMAT סומנה "מוציאה" ב־5 מתוך 5)
const SKIP_PRE = /(?:excess|settlement of|exercise of|incremental(?: non-cash)?|accelerated|one-time|(?:income )?tax (?:benefits?|effects?) (?:of|from|on|related to)|acquisition[- ]related(?: cash)?(?: and| &)?)\s*$/;
const SKIP_POST = /compensation awards? (?:with|using)|tax (?:benefit|deduction)/;
// המשך במילים (הערת שוליים או משפט, לא שורה בטבלה): PYPL "…compensation expense associated with restructuring", ‏WMT "…payment
// plans in anticipation…", ‏HON "…stock compensation expense, pension…", ‏UBER "…compensation expenses. 11". "net of tax" — שורה (TSLA)
const PROSE = /^(?:\s*expenses?)?\s*(?:associated|in anticipation|which|that|is|was|were|has|have|had|primarily|relates?|related to|of|for|from|plans?|as a percentage)\b|^[^\d(]{0,25}\.\s|^(?:\s*expenses?)?\s*,\s*(?!net of tax)[a-z]/;
// שורה עם מספרים מיד אחריה (ABNB: שורה בטבלת EBITDA — לא "תיאור במילים")
const NUMROW = /^(?:\s*expenses?\d?)?\s*(?:\(\d\)\s*)?(?:\$\s*)?(?:\(?\d|-\s|—)/;
// היעד של טבלת ההתאמה: השורה הראשונה מהסוגים האלה אחרי שורת התגמול
// גם בצורה "net income on non-gaap basis" (AVGO — כל שורה בטבלה: "<מדד> on gaap basis" … "<מדד> on non-gaap basis")
// "adjusted (non-gaap) net income" — הסוגריים באמצע (Ciena, ‏B-030).
// מנהלות השקעות (B-027): ‏"after-tax realized income" (Ares), ‏"distributable earnings" (Blackstone, ‏Carlyle, ‏TPG, ‏Blue Owl) — הרווח
// למניה שעליו הרחוב בנוי. ‏"fee-related earnings" — לא רווח לבעלים, אבל ה־DE וה־RI נבנים ממנו (Blue Owl: הגישור מהרווח לפני מס
// ל־FRE, ואחריו ל־DE, יותר מ־1,500 תווים אחרי שורת התגמול) — מה שהוצא ממנו הוצא גם מהם. "\b" — לא "unrealized income"
const TGT = /\b(?:after-tax |adjusted )?(?:realized income|distributable earnings|fee[- ]related earnings)|(?:non-gaap|adjusted|core|cash)\s+(?:\((?:non-gaap|adjusted)\)\s+)?(?:diluted\s+)?(?:net income|net earnings|earnings per (?:diluted )?share|eps|(?:diluted )?(?:net )?(?:income|earnings|profit) per (?:diluted |common )?share|net income per (?:diluted )?share|net income attributable)|(?:net income|net earnings|(?:diluted )?(?:net )?(?:income|earnings) per (?:diluted |common )?share)(?: - diluted)? on (?:a )?non-gaap basis/;
const OTHER = /(?:non-gaap|adjusted)\s+(?:\((?:non-gaap|adjusted)\)\s+)?(?:operating (?:income|expenses?|margin|profit)|gross (?:profit|margin)|ebitda|ebit\b|free cash flow|segment)|segment (?:profit|operating income)|ebitda|operating activities|cash flows? from|effective (?:income )?tax rate|tax rate|(?:gross (?:margin|profit)|operating (?:income|expenses?|margin)|research and development|selling, general and administrative(?: expenses?)?|cost of (?:revenue|products|sales|goods sold)|provision for income taxes) on (?:a )?non-gaap basis/;
// דוח תזרים המזומנים (MSFT, ‏DIS) מול טבלת התאמה — מה הופיע אחרון לפני השורה
const CF = /operating activities|cash provided by|cash flows? (?:from|provided)|net cash/g;
const REC = /reconcil|non-gaap|adjusted|as reported|\bgaap\b/g;
// "no longer exclude" / "does not exclude" (NVDA); עם "will" לפני — רק מכאן והלאה (INTU)
const NEG = /(?:no longer|not|n't)\s+(?:\w+\s+){0,3}exclud\w*\s+(?:\w+\s+){0,6}?(?:stock|share|equity)[- ]?based/g;
const ER_Q = /(?:three|thirteen|twelve|fourteen|sixteen|six|nine) (?:months|weeks) ended|quarter ended|(?:first|second|third|fourth)[- ]quarter|\bq[1-4]\b/;

const lastOf = (s, re) => { let m, i = -1; re.lastIndex = 0; while ((m = re.exec(s))) i = m.index; return i; };

/* שיעור המס ה־non-GAAP שהחברה מצהירה (τ_ng, ‏docs/buffett-method-research.md §6.4, §13.1, §13.13). הרווח המותאם של הרחוב מחושב בשיעור
   הזה, ולכן הניכוי של התגמול אחרי מס — באותו שיעור. הנוסחים שנמצאו בהודעות (נבדק על 22 חברות, 19/11/2026):
   ServiceNow ‏"non-gaap tax rate of 21% for the three…"; Salesforce ‏"long-term projected tax rate of 20.5%"; Palantir ‏"long-term annual
   effective tax rate of 23.0%"; Adobe ‏"non-gaap effective income tax rate (*) 18.0 %"; Cardinal ו־Uber בטבלה ‏"non-gaap effective tax rate
   18.5% 21.9%"; Flex ‏"adjusted income tax rate 21%*"; NVIDIA ‏"non-gaap effective tax rate for the third quarter was 17.0%"; Qualcomm
   ‏"fixed estimated non-gaap tax rate of 12.5%". "tax rates to be between" (רבים, תחזית לשנה) — לא. הצהרה בתוך תחזית ("expect",
   ‏"outlook") — רק כשאין אחרת. מחזיר שבר (0.21) או null */
const TR = /(?:non-gaap|adjusted|long-term(?: projected| annual)?)(?: estimated| fixed)?(?: effective)?(?: income)? tax rate(?: (?:of|was|is|for (?:the )?(?:[a-z]+ )?(?:quarter|period|year)(?: [a-z0-9,]+){0,4}? was))?\s*(?:\(\S{1,3}\)\s*)?:?\s*(?:approximately |~\s*)?(\d{1,2}(?:\.\d{1,2})?)\s?%/g;
const GUIDE = /expect|outlook|guidance|anticipat|forecast|will be|for (?:the )?(?:full )?(?:fiscal )?(?:year|fy) 20\d\d/;
/* המס של המדד המותאם כבר כולל את הטבת המס על התגמול (מנהלות השקעות): "our methodology uses the tax benefits from certain expenses
   that are not included in these non-gaap metrics, such as equity-based compensation" (Ares), ‏"income taxes on adjusted earnings includes
   the benefit of tax deductions arising from equity-based compensation" (KKR), ‏"reflects the benefit of deductions … on certain expense
   items that are excluded from the underlying calculation of distributable earnings, such as equity-based compensation" (Carlyle, ‏TPG),
   ‏"reflect the benefit of tax deductions that are excluded when calculating distributable earnings (e.g., equity-based compensation" (Blue
   Owl). הרחוב = לפני התגמול, אחרי המס הנמוך שהוא יצר — ולכן הניכוי לפני מס (τ = 0), אחרת המגן נספר פעמיים */
const TB = /(?:uses?|includes?|reflects?) the (?:tax )?benefits? (?:of|from) (?:certain )?(?:tax )?(?:deductions?|expenses?)[^.]{0,200}?(?:such as|e\.g\.,?|including|arising from)\s*(?:stock|share|equity)[- ]?based compensation/;
/* בסיס המניות של המדד למניה, מהמשפט "<מדד> of $X billion ($Y/share)" (Blackstone: ‏$1.7 מיליארד, ‏$1.32 — ‏1.29 מיליארד מניות;
   Blue Owl: "$385.5 million, or $0.24 per adjusted share"). במבנה Up-C התגמול בגישור הוא של כל החברה, כולל בעלי היחידות, והמדד למניה
   מחולק על כולם — לא על מניות Class A שב־XBRL (Blue Owl: ‏699 מיליון מול כ־1.6 מיליארד). הלקוח משתמש בו רק כשהוא גדול מה־XBRL */
const NS = /(?:distributable earnings|\bde\b|(?:after-tax )?realized income|\bri\b|adjusted net income|\bani\b)(?:\s*\(\s*(?:de|ri|ani)\s*\))?(?: attributable to [a-z.,' ]{1,60}?)?(?: of| was| were)\s*\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(million|billion)(?:,?\s*or\s*|\s*\(\s*)\$\s?(\d+\.\d+)\s*(?:\/|per\s)\s*(?:adj(?:usted)?\.?\s*|common\s*|class a\s*)?share/;
function nShares(t) {
  const m = NS.exec(t);
  if (!m) return null;
  const v = +m[1].replace(/,/g, '') * (m[2] === 'billion' ? 1e9 : 1e6), y = +m[3];
  return y > 0 ? Math.round(v / y / 1e5) * 1e5 : null;
}
function taxRate(t) {
  let m, first = null, fg = null;
  TR.lastIndex = 0;
  while ((m = TR.exec(t))) {
    const v = Math.round(+m[1] * 100) / 1e4;
    if (!(v >= 0.05 && v <= 0.4)) continue;
    const bk = t.slice(Math.max(0, m.index - 160), m.index); // רק המשפט שלו — לא תחזית שבמשפט הקודם
    if (!GUIDE.test(bk.slice(bk.lastIndexOf('. ') + 1))) { first = v; break; }
    if (fg == null) fg = v;
  }
  return first != null ? first : fg != null ? fg : impliedRate(t);
}
/* בלי הצהרה במילים — השיעור המשתמע מטבלת הגישור: ההפרשה למס ה־non-GAAP ÷ (הרווח הנקי ה־non-GAAP + ההפרשה). Broadcom: "provision for
   income taxes on non-gaap basis $ 3,118" ו־"net income on non-gaap basis $ 16,372" → ‏16.0%. אומת מול Flex, שגם מצהירה (21%): המשתמע
   20.9%–21.1% בחמש ההודעות. רק שורות בטבלה (מספר מיד אחרי התווית), באותה טבלה (עד 3,000 תווים) */
// "non-gaap tax provision on adjusted income before income taxes 76,919 … adjusted (non-gaap) net income $ 307,674" (Ciena — 20.0%)
const PL = /(?:non-gaap|adjusted) (?:provision for income taxes|income tax (?:expense|provision)|provision for taxes|income taxes)|provision for income taxes on (?:a )?non-gaap basis|non-gaap tax provision(?: on [a-z ]{0,50}?income taxes)?/g;
const NL = /(?:non-gaap|adjusted)(?: \((?:non-gaap|adjusted)\))? net (?:income|earnings)(?! per| attributable to non)(?: attributable to [a-z.,' ]{0,40}?)?|net income on (?:a )?non-gaap basis/g;
const NV = /^\s*(?:\(\w{1,2}\)\s*)*(?:\$\s*)?(\(?)((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\)?/;
function rowsOf(t, re) {
  const out = [];
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(t)) && out.length < 20) { const v = NV.exec(t.slice(m.index + m[0].length, m.index + m[0].length + 30)); if (v) out.push({ i: m.index, v: (v[1] ? -1 : 1) * +v[2].replace(/,/g, '') }); }
  return out;
}
function impliedRate(t) {
  const N = rowsOf(t, NL);
  for (const p of rowsOf(t, PL)) {
    const n = N.find((x) => Math.abs(x.i - p.i) < 3000 && x.v > 0);
    if (n && p.v > 0) { const r = p.v / (n.v + p.v); if (r >= 0.05 && r <= 0.4) return Math.round(r * 1000) / 1000; }
  }
  return null;
}
/* סוף הרבעון שההודעה מדווחת עליו — התאריך הראשון אחרי "three months ended" / "quarter ended" (qe, ‏YYYY-MM-DD). הלקוח מצמיד הודעה
   לרבעון לפיו: Marvell הגישה ב־2/11/2026 הודעת מיזוג (Item 2.02 — הכנסות מקדימות לרבעון שהסתיים ב־31/10), ארוכה מהודעת התוצאות
   של הרבעון הקודם ו־93 יום אחרי סופו — עד גרסה 3 היא נבחרה כהודעה של הרבעון שהסתיים ב־1/8, וקבעה "כולל" */
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
// התאריך המאוחר ביותר שעדיין לפני ההגשה (עד 150 יום): לא "השנה שהסתיימה" הקודמת (APA), לא רבעון התחזית (Salesforce)
const QE = /(?:(?:three|thirteen|twelve|fourteen|sixteen|six|nine) (?:months|weeks)|quarter|(?:fiscal )?year|period) ended,?\s+(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d\d)/g;
function qEnd(t, filed) {
  let m, best = null;
  const hi = filed || '9999', lo = filed ? new Date(Date.parse(filed) - 150 * 864e5).toISOString().slice(0, 10) : '0000';
  QE.lastIndex = 0;
  while ((m = QE.exec(t))) { const d = m[3] + '-' + String(MON[m[1]]).padStart(2, '0') + '-' + m[2].padStart(2, '0'); if (d < hi && d >= lo && (!best || d > best)) best = d; }
  return best;
}
/* הסכום בשורת התגמול בטבלת הגישור (§13.11): המספר הראשון אחרי התווית = העמודה של הרבעון. גולמי — במיליונים, באלפים או למניה;
   הלקוח מתאים את הסדר מול ה־XBRL של אותו רבעון (bufCalc). nt — השורה "net of tax" (כבר אחרי מס) */
// עד 8 מספרים מהשורה (5 רבעונים ושני מצטברים — Blackstone, ‏Carlyle, ‏Apollo): העמודה של הרבעון היא לרוב הראשונה, אבל לא תמיד — Intuit מציגה את רבעוני השנה זה לצד זה (543 521 485 … ‏1,549),
// והרבעון השלישי הוא השלישי. הלקוח בוחר את הקרוב ל־XBRL של אותו רבעון. "‎-related charges" (Palo Alto, ‏Snowflake), הערות שוליים "(2)(3)"
// "- time based 63,287" / "- other 90,715" (KKR, ‏Blue Owl — כמה שורות תגמול, הראשונה היא הרגילה). לא פיצול לפי פונקציה
// ("-research and development", Ciena) — שורה אחת היא רק חלק מהתגמול, והסכום נלקח מה־XBRL
const ROWP = /^(?:\s*(?:[-–]\s+(?!(?:cost|research|sales|selling|marketing|general|products?|services?|technology|operations|r&d)\b)[a-z][a-z -]{0,40}?(?=\s+\(?\$?\s*\d)|expenses?|costs?|-?\s*related (?:charges?|expenses?|costs?)|\(\w{1,2}\)|\d(?=\s)|,?\s*net of (?:income )?tax(?:es)?|\(?after[- ]tax\)?|[-–:*]))*/;
const NUM = /^\s*(?:\$\s*)?(\(?)\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*\)?(?!\s*%)|^\s*(?:\$\s*)?[-–—](?=\s)/;
function rowVals(after) {
  let s = after.slice(0, 220).replace(ROWP, ''), m;
  const out = [];
  while (out.length < 8 && (m = NUM.exec(s))) { if (m[2]) out.push(+m[2].replace(/,/g, '')); s = s.slice(m[0].length); }
  return out;
}
// טבלת תחזית (Salesforce: "q3 fy27 gaap diluted net income per share range … stock-based compensation expense $ 1.29") — לא הרבעון שדווח
const GUIDE_T = /guidance|outlook|\brange\b|expect|forecast/g, ENDED = /(?:months|weeks|quarter|year) ended/g;

/* "total adjustments related to income from operations … adjusted (non-gaap) net income" (Ciena, ‏B-030): גישור הרווח הנקי לוקח את סך
   ההתאמות של הרווח התפעולי — כולל התגמול שבגישור ההוצאות. רק כשהשורה בתוך גישור הרווח הנקי: עד 400 תווים לפניה "gaap net income" או
   "income before income taxes" בלי יעד אחר אחריו, ועד 600 תווים אחריה רווח נקי מותאם לפני כל יעד אחר */
const CARRY = /total (?:non-gaap )?adjustments (?:related )?to (?:income from operations|operating (?:income|loss|expenses?))/g;
function carried(t) {
  let m;
  CARRY.lastIndex = 0;
  while ((m = CARRY.exec(t))) {
    const bk = t.slice(Math.max(0, m.index - 400), m.index), h = Math.max(lastOf(bk, /gaap net (?:income|earnings)|income before (?:provision for )?income taxes/g), -1);
    if (h < 0 || OTHER.test(bk.slice(h))) continue;
    const fw = t.slice(m.index + m[0].length, m.index + m[0].length + 600), a = fw.search(TGT), b = fw.search(OTHER);
    if (a >= 0 && (b < 0 || a < b)) return true;
  }
  return false;
}
function classify(raw, filed) {
  const t = raw && raw.length && /</.test(raw.slice(0, 2000)) ? text(raw) : String(raw || '').toLowerCase().replace(/\s+/g, ' ');
  // הודעת תוצאות: רבעון + רווח למניה (MRK ו־XOM לא כותבות "diluted")
  const er = ER_Q.test(t) && /diluted|earnings per (?:common )?share|\beps\b/.test(t) && /net (?:income|earnings|loss)|earnings per share|per share/.test(t);
  let nowNeg = false, futNeg = false, m;
  NEG.lastIndex = 0;
  while ((m = NEG.exec(t))) { if (/will\s+$/.test(t.slice(Math.max(0, m.index - 8), m.index))) futNeg = true; else nowNeg = true; }
  const hits = [];
  let sa = null, nt = 0;
  SBC.lastIndex = 0;
  while ((m = SBC.exec(t)) && hits.length < 200) {
    const i = m.index, pre = t.slice(Math.max(0, i - 40), i), post = t.slice(i, i + 60);
    if (SKIP_PRE.test(pre) || SKIP_POST.test(post)) { hits.push('x'); continue; }
    const back = t.slice(Math.max(0, i - 1500), i), inCf = lastOf(back, CF) > lastOf(back, REC);
    const after = t.slice(i + m[0].length, i + m[0].length + 1500), a = after.search(TGT), b = after.search(OTHER), prose = PROSE.test(after.slice(0, 60)), row = NUMROW.test(after.slice(0, 40));
    if (!prose && !inCf && a >= 0 && (b < 0 || a < b)) {
      hits.push('E');
      // הסכום — מהשורה הראשונה בגישור שיש בה מספר (לא כפול: השורה הבאה היא לרוב של תקופה אחרת או של תחזית)
      if (sa == null) {
        const b6 = t.slice(Math.max(0, i - 600), i), g = lastOf(b6, GUIDE_T);
        const v = g >= 0 && g > lastOf(b6, ENDED) ? [] : rowVals(after).filter((x) => x > 0);
        if (v.length) { sa = v; nt = /^[^0-9]{0,30}(?:net of (?:income )?tax|after[- ]tax)/.test(after) ? 1 : 0; }
      }
      continue;
    }
    // במילים: "non-GAAP net income / results / measures … exclude … stock-based compensation" — באותו משפט, לא על EBITDA בלבד (UBER, ‏IBM).
    // המשפט כולו: בלי תחילת משפט בטווח — לא נספר (APP 4Q25: הגדרה ארוכה של Adjusted EBITDA, שהחיתוך שלה השאיר רק "net income adjusted … excluding")
    const b700 = t.slice(Math.max(0, i - 700), i), dot = b700.lastIndexOf('. '), s = dot >= 0 ? b700.slice(dot + 1) : '';
    if (!row && s && /non-gaap|adjusted/.test(s) && /exclud/.test(s) && !/ebitda|number of shares|share count|weighted[- ]average shares/.test(s) && /net income|per share|\beps\b|earnings|results|measures|guidance/.test(s)) { hits.push('P'); continue; }
    // גישור בשרשרת (Ciena): התגמול בגישור ההוצאות התפעוליות, והסך שלהן עובר לגישור הרווח הנקי — ראו CARRY
    const mo = !prose && !inCf && b >= 0 && (a < 0 || b < a) ? after.slice(b).match(OTHER) : null;
    hits.push(mo && /operating (?:income|expenses?|profit)|gross (?:profit|margin)/.test(mo[0]) && !/ebitda|segment|cash|tax/.test(mo[0]) ? 'o' : inCf ? 'c' : '-');
  }
  const carry = hits.includes('o') && carried(t);
  const ex = !nowNeg && (hits.some((h) => h === 'E' || h === 'P') || carry);
  return { ex, fut: ex && !futNeg, er, n: t.length, h: (nowNeg ? 'N' : futNeg ? 'F' : '') + hits.join('').slice(0, 40), tr: taxRate(t), tb: ex && TB.test(t) ? 1 : 0, ns: ex ? nShares(t) : null, sa: ex ? sa : null, nt: ex && sa != null ? nt : 0, qe: qEnd(t, filed), k: hits.length };
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
  const c = classify(t, k.filed);
  return { filed: k.filed, er: c.er, ex: c.ex, fut: c.fut, n: c.n, h: c.h, tr: c.tr, tb: c.tb, ns: c.ns, sa: c.sa, nt: c.nt, qe: c.qe, k: c.k, sv: SV };
}

/* לתשובה: [[תאריך הגשה, ex, fut, אורך, tr, sa, nt, qe, k — כמה אזכורים של התגמול], …] — רק הודעות תוצאות, מהישנה לחדשה. כמה הודעות לאותו רבעון (הודעה מקדימה,
   עדכון תחזית) — הלקוח בוחר את הארוכה, ההודעה המלאה. רשומה מגרסת מסווג קודמת — נשלחת עד שעבודת הרקע קוראת אותה מחדש (fillSx),
   כדי שהחלפת גרסה לא תשאיר את כל החברות בלי מדיניות לכמה שעות (בלי tr ו־sa — null) */
const forClient = (sx) => Object.values(sx || {}).filter((r) => r && r.er && r.sv > 0).sort((a, b) => (a.filed < b.filed ? -1 : 1))
  .map((r) => [r.filed, r.ex ? 1 : 0, r.fut ? 1 : 0, r.n || 0, r.tr > 0 ? r.tr : null, Array.isArray(r.sa) && r.sa.length ? r.sa : null, r.nt ? 1 : 0, r.qe || null, r.k || 0, r.tb ? 1 : 0, r.ns > 0 ? r.ns : null]);

module.exports = { classify, pick, readOne, forClient, text, SV, MAX };
