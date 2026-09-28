/* v239: חיפוש מניות סובלני לטעויות (מידע ציבורי בלבד).
   היקום: קובץ סטטי lib/universe.txt — כל המניות בארה"ב לפי שווי שוק + קרנות סל (tools/stock-universe.js).
   סטטי ולא נשלף בזמן ריצה: שרתים של Vercel נחסמים לעתים ב־SEC/Nasdaq, ומניות חדשות מגיעות מ־Yahoo search.
   למה: Yahoo search מוצא רק התאמה מדויקת/תחילית ("nvidea", "microsft", "tesle", "redit", "rdtt" → כלום). */

const STOP = new Set(['inc', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited', 'plc', 'the', 'class', 'common', 'stock',
  'shares', 'share', 'ordinary', 'sa', 'nv', 'ag', 'lp', 'llc', 'adr', 'ads', 'depositary', 'american', 'each', 'representing', 'de', 'reit']);
// שמות מוכרים שאינם שם החברה הרשמי
const ALIAS = { facebook: 'META', google: 'GOOGL', coke: 'KO', 'coca cola': 'KO', berkshire: 'BRK-B', 'berkshire b': 'BRK-B', 'jp morgan': 'JPM', 'j p morgan': 'JPM',
  'tsmc': 'TSM', 'taiwan semi': 'TSM', 'snapchat': 'SNAP', 'instagram': 'META', 'whatsapp': 'META', 'youtube': 'GOOGL', 'sp500': 'VOO', 's p 500': 'VOO', 'nasdaq 100': 'QQQ' };

function normName(s) {
  return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function nameWords(s) {
  return normName(s).split(' ').filter((w) => w && !STOP.has(w));
}

/* מרחק Damerau–Levenshtein (החלפת שתי אותיות סמוכות = טעות אחת: rdtt↔rddt) עם עצירה מוקדמת מעל max */
function dl(a, b, max) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > max) return max + 1;
  let p2 = new Array(n + 1).fill(0), p1 = new Array(n + 1), cur;
  for (let j = 0; j <= n; j++) p1[j] = j;
  for (let i = 1; i <= m; i++) {
    cur = new Array(n + 1);
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      let v = Math.min(p1[j] + 1, cur[j - 1] + 1, p1[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    p2 = p1; p1 = cur;
  }
  return p1[n];
}
const tol = (len) => (len >= 8 ? 2 : len >= 4 ? 1 : 0);

/* היקום: lib/universe.txt (tools/stock-universe.js) — שורה SYM|שם|E, לפי שווי שוק (קרנות סל בסוף). r = מיקום = דירוג */
function parseUniverse(txt) {
  const list = [];
  for (const ln of String(txt || '').split('\n')) {
    if (!ln) continue;
    const c = ln.split('|');
    if (!c[0]) continue;
    const x = { s: c[0], n: c[1] || c[0], r: list.length + 1, etf: c[2] === 'E' };
    x.w = nameWords(x.n); x.nn = x.w.join(' ');
    list.push(x);
  }
  return list;
}
let _uni = null;
function universe() {
  if (!_uni) {
    try { _uni = parseUniverse(require('fs').readFileSync(require('path').join(__dirname, 'universe.txt'), 'utf8')); } catch (e) { _uni = []; }
  }
  return _uni;
}

/* ציון לשאילתה. 0 = לא מתאים. דירוג (r) מכריע בין ציונים קרובים — "tesle" → TSLA לפני חברות קטנות */
function scoreEntry(x, q, qWords) {
  const Q = q.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const sym = x.s.replace(/[-.]/g, '');
  let sc = 0;
  if (Q && sym === Q) sc = 1000;
  else if (Q && Q.length >= 2 && sym.startsWith(Q)) sc = 700 - (sym.length - Q.length) * 20;
  if (x.nn && qWords.length) {
    const qj = qWords.join(' ');
    const qs = qj.replace(/ /g, ''), ns = x.nn.replace(/ /g, ''); // "cocacola", "service now" — בלי תלות ברווחים
    if (x.nn === qj || (qs.length >= 5 && ns === qs)) sc = Math.max(sc, 900);
    else if (x.nn.startsWith(qj) || (qs.length >= 5 && ns.startsWith(qs))) sc = Math.max(sc, 760);
    else if (qs.length >= 6 && dl(qs, ns.slice(0, qs.length), tol(qs.length)) <= tol(qs.length)) sc = Math.max(sc, 470);
    else if (qj.length >= 3 && x.nn.includes(' ' + qj)) sc = Math.max(sc, 600);
    else if (qj.length >= 4) {
      // כל מילה בשאילתה מתאימה (בטעות קלה) למילה בשם — או לתחילתה
      let tot = 0, okAll = true, first = false;
      for (const w of qWords) {
        let best = 9;
        for (const nw of x.w) {
          const b0 = best;
          if (nw === w) { best = 0; first = nw === x.w[0]; break; }
          const t = tol(w.length);
          if (w.length >= 3 && nw.startsWith(w)) best = Math.min(best, 0.5);
          else if (t) {
            best = Math.min(best, dl(w, nw, t));
            if (nw.length > w.length) best = Math.min(best, dl(w, nw.slice(0, w.length), t) + 0.5);
          }
          if (best < b0 && nw === x.w[0]) first = true; else if (best < b0) first = false;
        }
        if (best > tol(w.length) + 0.5) { okAll = false; break; }
        tot += best;
      }
      if (okAll) sc = Math.max(sc, 520 - tot * 110 + (first ? 30 : 0)); // המילה הראשונה בשם = שם החברה (לא ETF שמזכיר אותה)
    }
  }
  if (sc < 400 && Q.length >= 3 && Q.length <= 6 && sym.length >= 3) {
    const d = dl(Q, sym, 1);
    if (d <= 1) sc = Math.max(sc, 420); // טעות בסימבול (rdtt → RDDT); טעות בשם החברה עדיין קודמת (redit → Reddit לפני EDIT)
  }
  if (!sc) return 0;
  return sc + Math.max(0, 80 - Math.log(x.r || 9000) * 9); // בונוס גודל: הגדולות למעלה
}

function searchUniverse(list, query, limit) {
  const q = String(query || '').trim();
  if (!q || !list || !list.length) return [];
  const qWords = nameWords(q);
  const out = [];
  const al = ALIAS[normName(q)];
  for (const x of list) {
    const sc = x.s === al ? 1100 : scoreEntry(x, q, qWords);
    if (sc > 0) out.push({ x, sc });
  }
  out.sort((a, b) => b.sc - a.sc);
  return out.slice(0, limit || 8).map(({ x, sc }) => ({ sym: x.s, name: x.n, type: x.etf ? 'ETF' : 'EQUITY', sc: Math.round(sc) }));
}

module.exports = { dl, normName, nameWords, parseUniverse, universe, scoreEntry, searchUniverse };
