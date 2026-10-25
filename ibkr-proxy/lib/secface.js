/* הדוחות כפי שהחברה הגישה אותם (25/10/2026, שכבה 1 בבקרת הדיוק של מנתח החברות).
   לכל 10-K / 20-F ב־EDGAR יש FilingSummary.xml ודפי R — הדוח המעובד: לכל שורה התגית, הכותרת שהחברה בחרה והערכים.
   מזה: (1) איזו תגית החברה עצמה מציגה בדוח רווח והפסד / מאזן / תזרים — במקום לנחש מרשימה;
   (2) הערכים של 3 השנים האחרונות כפי שהודפסו — להשוואה אוטומטית של כל מספר שאנחנו מציגים.
   טהור ובלי תלויות; הרשת — ב־fundamentals.js. */

const STMT = {
  is: /statements? of (consolidated )?(operations|income|earnings)|income statements?|statements? of (comprehensive )?(income|loss)|profit (and|or) loss|operations and comprehensive|results of operations/i,
  bs: /balance sheets?|(statements? of )?financial (position|condition)|statement of condition/i,
  cf: /cash flows?/i,
};
const SKIP = /parenthetical|comprehensive income(?! and)|changes in|equity|segment|supplement/i;

/* מתוך FilingSummary.xml — קובץ ה־R של כל אחד משלושת הדוחות (הראשון שמתאים בקטגוריה Statements) */
function pickStatements(xml) {
  const out = {};
  const re = /<Report\b[^>]*>([\s\S]*?)<\/Report>/g;
  let m;
  while ((m = re.exec(String(xml || '')))) {
    const r = m[1], g = (t) => { const x = new RegExp('<' + t + '>([\\s\\S]*?)</' + t + '>').exec(r); return x ? x[1].trim() : ''; };
    if (g('MenuCategory') !== 'Statements') continue;
    const name = g('ShortName'), file = g('HtmlFileName');
    if (!/^R\d+\.htm$/.test(file)) continue;
    for (const k of ['is', 'bs', 'cf']) {
      if (out[k] || !STMT[k].test(name)) continue;
      // "Statements of Comprehensive Income" לבד — לא דוח רווח והפסד; "of Operations and Comprehensive Income" — כן
      if (k === 'is' && SKIP.test(name) && !/operations|income and comprehensive|earnings/i.test(name)) continue;
      if (k !== 'is' && /parenthetical/i.test(name)) continue;
      out[k] = file;
      break;
    }
  }
  return out;
}

const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function isoDate(s) {
  const m = /([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s+(\d{4})/.exec(s || '');
  if (!m || !MON[m[1].toLowerCase()]) return null;
  return m[3] + '-' + String(MON[m[1].toLowerCase()]).padStart(2, '0') + '-' + m[2].padStart(2, '0');
}
// ישויות מספריות (€ = &#8364;, ¥ = &#165;) — מפוענחות: קנה המידה והמטבע של עמודה כתובים בהן
const strip = (s) => String(s).replace(/<sup[\s\S]*?<\/sup>/g, '').replace(/<br\s*\/?>|<\/div>/g, ' ').replace(/<[^>]+>/g, '').replace(/&#160;|&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&#(\d+);/g, (_, n) => (+n < 0x10000 ? String.fromCharCode(+n) : '')).replace(/\s+/g, ' ').trim();
function num(s) {
  // סימני מטבע (גם ₩, kr, CHF…) והערות שוליים יורדים — נשארות רק ספרות, נקודה, פסיק, סוגריים ומינוס
  const t = strip(s).replace(/\[\d+\]/g, '').replace(/[^\d.,()\-—–]/g, '');
  if (!t || /^[—–-]+$/.test(t)) return null;
  const neg = /^\(.*\)$/.test(t), v = parseFloat(t.replace(/[(),]/g, ''));
  return isFinite(v) ? (neg ? -v : v) : null;
}
const SCALE = { thousands: 1e3, millions: 1e6, billions: 1e9 };
// סימן מטבע בכותרת → קודי ISO (¥ = יואן או ין)
const SYM_CUR = { '$': ['USD'], 'US$': ['USD'], '€': ['EUR'], '£': ['GBP'], '¥': ['CNY', 'JPY'], '₩': ['KRW'], '₹': ['INR'], 'NT$': ['TWD'], 'R$': ['BRL'], 'C$': ['CAD'], 'A$': ['AUD'],
  'HK$': ['HKD'], 'S$': ['SGD'], '₪': ['ILS'], 'kr': ['SEK', 'NOK', 'DKK'], 'CHF': ['CHF'], 'RUB': ['RUB'], '₽': ['RUB'], '₨': ['INR', 'PKR'], 'Rs': ['INR'], 'S/': ['PEN'], 'R': ['ZAR'], 'Mex$': ['MXN'], 'MX$': ['MXN'] };

/* דף R → { title, cols:[{end, months}], scale:{cur, sh}, rows:[{tag, label, total, v:[...]}] } — הערכים כבר בדולרים/מניות מלאים */
function parseR(html) {
  const h = String(html || '');
  const tm = /<th class="tl"[\s\S]*?<strong>([\s\S]*?)<\/strong>/.exec(h);
  const title = tm ? strip(tm[1].replace(/<br\s*\/?>/g, ' | ')) : '';
  // "€ in Millions, shares in Millions" / "¥ in Millions, shares in Millions, $ in Millions" — קנה המידה של המניות ושל הכסף (הראשון שאינו מניות)
  const scale = { cur: 1, sh: 1 }, bySym = [];
  let curSet = false;
  for (const seg of title.split(/[|,]/)) {
    const x = /(\S*)\s+in\s+(Thousands|Millions|Billions)\b/i.exec(seg); if (!x) continue;
    const f = SCALE[x[2].toLowerCase()] || 1;
    if (/^shares?$/i.test(x[1])) { scale.sh = f; continue; }
    bySym.push([x[1], f]);
    if (!curSet) { scale.cur = f; curSet = true; }
  }
  // כותרות: שורה ראשונה = קבוצות ("12 Months Ended", colspan), שנייה = תאריכים
  const heads = [...h.matchAll(/<tr>\s*([\s\S]*?)<\/tr>/g)].slice(0, 3).map((x) => x[1]);
  const groups = [], ends = [];
  for (const row of heads) {
    for (const th of row.matchAll(/<th class="th"([^>]*)>([\s\S]*?)<\/th>/g)) {
      const txt = strip(th[2]), span = +((/colspan="(\d+)"/.exec(th[1]) || [])[1] || 1), d = isoDate(txt);
      // מטבע העמודה ("USD ($)", "CNY (¥)") — בדוחות של חברות זרות יש לפעמים עמודת המרה לדולר באותה שנה
      if (d) ends.push([d, (/\b([A-Z]{3})\s*\(/.exec(txt) || [])[1] || null]);
      else { const mm = /(\d+)\s+Months?\s+Ended/i.exec(txt); for (let i = 0; i < span; i++) groups.push(mm ? +mm[1] : null); }
    }
  }
  const cols = ends.map(([end, cur], i) => ({ end, months: groups.length ? (groups[i] != null ? groups[i] : null) : null, cur }));
  // קנה מידה לכל עמודה לפי המטבע שלה: "¥ in Millions, $ in Millions" — לכל מטבע משלו; "$ in Millions" כשיש גם עמודת NT$
  // (Chunghwa) — רק הדולר במיליונים, השאר ביחידות
  // ("$ in Thousands, $ in Thousands" — גם NT$ מוצג כ־$): כשמספר המקטעים = מספר המטבעות בעמודות — לפי סדר ההופעה
  const curs = [...new Set(cols.map((c) => c.cur).filter(Boolean))];
  if (bySym.length > 1 && bySym.length === curs.length) scale.cols = cols.map((c) => (c.cur ? bySym[curs.indexOf(c.cur)][1] : scale.cur));
  else if (bySym.length && curs.length) {
    scale.cols = cols.map((c) => {
      if (!c.cur) return scale.cur;
      const m = bySym.find(([sy]) => (SYM_CUR[sy] || [sy.toUpperCase()]).includes(c.cur));
      return m ? m[1] : bySym.length === 1 && !(SYM_CUR[bySym[0][0]] || []).length ? scale.cur : 1;
    });
  }
  const rows = [];
  for (const tr of h.matchAll(/<tr class="(r[eo]u?)">([\s\S]*?)<\/tr>/g)) {
    const body = tr[2], tag = (/defref_([A-Za-z0-9-]+)_([A-Za-z0-9_]+)/.exec(body) || []);
    if (!tag[2]) continue;
    const lab = /<td class="pl"[\s\S]*?<\/td>/.exec(body);
    // תא עם מאפיינים נוספים (<td colspan="2" class="nump"> — SAP) הוא עדיין תא של ערך; תאי הערות שוליים (fn) — לא
    const v = [...body.matchAll(/<td\b[^>]*\bclass="(?:nump|num|text)"[^>]*>([\s\S]*?)<\/td>/g)].map((x) => num(x[1]));
    if (!v.some((x) => x != null)) continue;
    rows.push({ ns: tag[1], tag: tag[2], label: lab ? strip(lab[0]) : '', total: /u$/.test(tr[1]), v });
  }
  return { title, cols, scale, rows };
}

/* ערך של שורה, בקנה המידה הנכון: למניה — כמו שהוא; מניות — לפי "shares in"; השאר — לפי "$ in" */
const PER_SH = /PerShare|Per(Basic|Diluted)(And(Basic|Diluted))?Share|PerOutstandingLimitedPartnershipUnit/;
/* עמודה במטבע אחר ממטבע הדיווח (עמודת המרה) — לא משווים אליה */
const colOk = (c, cur) => !c.cur || !cur || c.cur === cur;
const SHARES = /Shares(Outstanding|Issued)?$|NumberOfShares|SharesOutstanding/;
function rowVals(st, row) {
  const ps = PER_SH.test(row.tag), sh = !ps && SHARES.test(row.tag);
  return row.v.map((x, i) => {
    if (x == null) return null;
    const f = ps ? 1 : sh ? st.scale.sh : (st.scale.cols && st.scale.cols[i] != null ? st.scale.cols[i] : st.scale.cur);
    return Math.round(x * f * 1e4) / 1e4;
  });
}

module.exports = { pickStatements, parseR, rowVals, colOk, isoDate, num };
