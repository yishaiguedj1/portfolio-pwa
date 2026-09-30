/* v256: לוגו אופקי (wordmark) של חברה — לגרף "רווח/הפסד מהקנייה" בסקירה. מידע ציבורי בלבד.
   Wikidata: מניה לפי הסימבול בבורסה (P414 + P249: NYSE/Nasdaq לארה"ב, ת"א ל־.TA) → לוגו רשמי (P154) → Wikimedia Commons
   (תמונה ממוזערת PNG ברוחב 500, רקע שקוף, CORS פתוח, רישוי חופשי). נבדק 29/09/2026 על ADBE/NOW/META/MSFT/LUMI/POLI…
   1000logos נבדק ונפסל: בלי ממשק, כתובות לא צפויות, בלי CORS, ותנאי שימוש לא ברורים. */
const EX_US = ['Q13677', 'Q82059']; // NYSE, Nasdaq
const EX_TA = 'Q1507974'; // בורסת תל אביב
// לוגו שגוי/חסר ב־Wikidata → קובץ מפורש ב־Commons (שם קובץ בלי "File:")
const OVERRIDES = {
  UNH: 'UnitedHealthcare (logo).svg', // הרשמי ארוך ודק מדי (פי 13) — לא קריא בפס; זה עם ה־U, בשתי שורות (פי 3.2) — בקשת המשתמש
  // v259: ב־Wikidata הטיקר רשום גם אצל Google וגם אצל Alphabet — הבחירה ביניהם לא יציבה. המשתמש בחר Alphabet
  GOOGL: 'Alphabet Inc Logo 2015.svg',
  GOOG: 'Alphabet Inc Logo 2015.svg',
};
/* v259: שוליים ריקים בתוך הקובץ (נמדדו בקנבס על ~100 לוגואים של ארה"ב ות"א, 29/09/2026) — מסגרת הדיו [x0,y0,x1,y1]
   כשבר מהתמונה, לפי שם הקובץ. האפליקציה חותכת לפיה, כדי שהלוגו ינצל את כל הגובה בפס (מובילאיי: ‎−23% גובה בלי חיתוך) */
const INK = {
  'Costco_Wholesale_logo_2010-10-26.svg': [0.054, 0.144, 0.964, 0.844],
  'TexasInstruments-Logo.svg': [0.024, 0.065, 0.976, 0.935],
  'Shopify_logo_2018.svg': [0, 0.032, 1, 0.943],
  'Caterpillar_logo.svg': [0.016, 0.044, 0.986, 0.933],
  'Mobileye_logo_(new).svg': [0, 0.141, 1, 0.909],
  'Check_Point_logo_2022.svg': [0.044, 0.054, 0.99, 0.946],
  // v277: בדיקה מקיפה (649 סמלים: 300 הגדולות בארה"ב, מניות ת"א, תיק הדמו) — כל לוגו עם שוליים של 3%+ בלי מסגרת
  'Applied_Materials_Logo.svg': [0.012, 0.067, 0.988, 0.933], // AMAT
  'Pmi_logo_text_only.svg': [0.006, 0.033, 0.994, 0.967], // PM
  'Shell_wordmark_2019.svg': [0, 0.035, 1, 0.955], // SHEL
  'Astrazeneca_text_logo.svg': [0, 0.018, 1, 0.968], // AZN
  'John_Deere_text_only.png': [0, 0.104, 1, 1], // DE
  'VertexPharma-logo2.png': [0.053, 0.135, 0.947, 0.896], // VRTX
  'Bristol-Myers_Squibb_logo_(2020).svg': [0.002, 0.064, 0.998, 0.936], // BMY
  'Logo_of_Booking_Holdings_Inc,(lock_up,_stacked_with_Brands,_full_color).PNG': [0.048, 0.015, 0.95, 0.978], // BKNG
  'AppLovin-Logo.gif': [0.023, 0.31, 0.93, 0.73], // APP
  'Vertiv_logo.svg': [0.01, 0.022, 0.958, 0.97], // VRT
  '2019_HCA_logo.svg': [0.014, 0.033, 0.99, 0.967], // HCA
  'Agnico-Eagle.svg': [0.022, 0.056, 0.978, 0.944], // AEM
  'General-Dynamics-Logo.svg': [0.004, 0.174, 0.998, 0.826], // GD
  'Johnson_Controls_old_logo.svg': [0.01, 0.061, 0.99, 0.939], // JCI
  'American_Tower_Corporation_logo.svg': [0.01, 0.038, 0.99, 0.967], // AMT
  'CPKC_Wordmark.svg': [0.026, 0.11, 0.98, 0.875], // CP
  'SLB_Logo_2022.svg': [0.118, 0.172, 0.882, 0.825], // SLB
  'Target_logo.svg': [0.038, 0.056, 0.962, 0.942], // TGT
  'Digital_Realty_TM_Brandmark_RGB_Black.svg': [0.084, 0.187, 0.916, 0.809], // DLR
  'United_Rentals_Logo.svg': [0, 0.032, 1, 0.961], // URI
  'UMC-Logo.svg': [0.012, 0.086, 0.988, 0.914], // UMC
  'PACCAR-logo.svg': [0.026, 0.06, 0.978, 0.931], // PCAR
  'Ametek-Logo.svg': [0, 0.045, 1, 0.988], // AME
  'Flad_of_Delek_2000.svg': [0, 0.071, 1, 1], // DLEKG.TA
  'Bazan_logo.jpg': [0.19, 0.23, 0.814, 0.77], // ORL.TA
  'Energix_Logo.svg': [0, 0.256, 1, 0.742], // ENRG.TA
  'Castro_(clothing)_logo.png': [0, 0, 1, 0.925], // CAST.TA
  'Terminal_X_Logo.jpg': [0.014, 0.193, 0.988, 0.807], // TRX.TA
  'Spacecom_logo_as_at_2026.png': [0, 0.041, 1, 0.899], // SCC.TA
  'Jungo_Connectivity_logo.jpg': [0.134, 0.109, 0.866, 0.891], // JNGO.TA
  'Occidental-Petroleum-Logo.svg': [0.058, 0.042, 0.942, 0.958], // OXY
  'Verisign_logo.svg': [0.016, 0.062, 1, 0.932], // VRSN
  'D._R._Horton_logo.svg': [0, 0.226, 1, 0.818], // DHI
};

/* v277: לוגו שלא קריא בפס (אייקון גדול + טקסט זעיר בשתי שורות) — בלי לוגו אופקי, האפליקציה מציגה אייקון + שם */
const NO_WM = new Set(['DLR', 'AMT']);
/* טהורה: סימבול של Yahoo → { ticker, ex } לחיפוש ב־Wikidata */
function tickerOf(sym) {
  if (NO_WM.has(String(sym || '').toUpperCase())) return null;
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
    const bx = INK[title.replace(/ /g, '_')];
    if (bx) v.bx = bx;
    out[title] = v;
    if (norm['File:' + title]) out[String(norm['File:' + title]).replace(/^File:/, '')] = v;
  }
  return out;
}

module.exports = { NO_WM, tickerOf, sparqlFor, pickFiles, pickThumbs, OVERRIDES, INK, EX_TA, EX_US };
