/* v256: לוגו אופקי (wordmark) של חברה — לגרף "רווח/הפסד מהקנייה" בסקירה. מידע ציבורי בלבד.
   Wikidata: מניה לפי הסימבול בבורסה (P414 + P249: NYSE/Nasdaq לארה"ב, ת"א ל־.TA) → לוגו רשמי (P154) → Wikimedia Commons
   (תמונה ממוזערת PNG ברוחב 500, רקע שקוף, CORS פתוח, רישוי חופשי). נבדק 29/09/2026 על ADBE/NOW/META/MSFT/LUMI/POLI…
   1000logos נבדק ונפסל: בלי ממשק, כתובות לא צפויות, בלי CORS, ותנאי שימוש לא ברורים. */
const EX_US = ['Q13677', 'Q82059']; // NYSE, Nasdaq
const EX_TA = 'Q1507974'; // בורסת תל אביב
// לוגו שגוי/חסר ב־Wikidata → קובץ מפורש ב־Commons (שם קובץ בלי "File:")
const OVERRIDES = {
  UNH: 'UnitedHealthcare (logo).svg', // הרשמי ארוך ודק מדי (פי 13) — לא קריא בפס; זה עם ה־U, בשתי שורות (פי 3.2) — בקשת המשתמש
};

/* טהורה: סימבול של Yahoo → { ticker, ex } לחיפוש ב־Wikidata */
function tickerOf(sym) {
  const s = String(sym || '').toUpperCase();
  if (/^\^/.test(s)) return null; // מדד
  if (/\.TA$/.test(s)) { const b = s.replace(/\.TA$/, ''); return /^[A-Z][A-Z0-9]{0,9}$/.test(b) ? { ticker: b, ex: [EX_TA] } : null; }
  return /^[A-Z][A-Z0-9-]{0,9}$/.test(s) ? { ticker: s.replace(/-/g, '.'), ex: EX_US } : null;
}

/* טהורה: שאילתת SPARQL לכמה סימבולים (הלוגו מהדירוג הטוב ביותר — wdt:P154) */
function sparqlFor(syms) {
  const vals = [], exs = new Set();
  for (const s of syms) { const t = tickerOf(s); if (t) { vals.push('"' + t.ticker + '"'); t.ex.forEach((e) => exs.add(e)); } }
  if (!vals.length) return null;
  return 'SELECT ?t ?ex ?logo WHERE { VALUES ?t { ' + [...new Set(vals)].join(' ') + ' } VALUES ?ex { ' +
    [...exs].map((e) => 'wd:' + e).join(' ') + ' } ?item p:P414 ?st . ?st ps:P414 ?ex ; pq:P249 ?t . ?item wdt:P154 ?logo . }';
}

/* טהורה: תשובת SPARQL → { SYM: 'שם קובץ' } — רק מהבורסה של הסימבול */
function pickFiles(syms, bindings) {
  const out = {};
  for (const s of syms) {
    const t = tickerOf(s);
    if (!t) continue;
    if (OVERRIDES[s]) { out[s] = OVERRIDES[s]; continue; }
    const b = (bindings || []).find((x) => x.t && x.t.value === t.ticker && x.ex && t.ex.includes(String(x.ex.value).split('/').pop()) && x.logo);
    if (b) out[s] = decodeURIComponent(String(b.logo.value).split('/Special:FilePath/').pop() || '').replace(/_/g, ' ');
  }
  return out;
}

/* טהורה: תשובת imageinfo של Commons → { 'שם קובץ': { url, w, h } } (URL ממוזער בלי פרמטרי מעקב) */
function pickThumbs(json) {
  const out = {};
  const pages = (json && json.query && json.query.pages) || {};
  const norm = {};
  for (const n of ((json && json.query && json.query.normalized) || [])) norm[n.to] = n.from;
  for (const p of Object.values(pages)) {
    const i = p && p.imageinfo && p.imageinfo[0];
    if (!i || !i.thumburl || !(i.thumbwidth > 0) || !(i.thumbheight > 0)) continue;
    const title = String(p.title || '').replace(/^File:/, '');
    const url = String(i.thumburl).split('?')[0];
    if (!/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(url)) continue;
    const v = { url, w: i.thumbwidth, h: i.thumbheight };
    out[title] = v;
    if (norm['File:' + title]) out[String(norm['File:' + title]).replace(/^File:/, '')] = v;
  }
  return out;
}

module.exports = { tickerOf, sparqlFor, pickFiles, pickThumbs, OVERRIDES, EX_TA, EX_US };
