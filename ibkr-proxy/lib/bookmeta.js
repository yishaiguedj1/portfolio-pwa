/* פרטי ספר ממאגרים רשמיים — כמו "הורדת מטא־דאטה" של Calibre, ועם הספרייה הלאומית לעברית.
   ארבעה מקורות במקביל, כל אחד מפוענח לאותו מבנה:
     google      — Google Books (אנגלית מצוין, עברית חלקית, כריכות; GOOGLE_BOOKS_KEY אופציונלי — בלי מפתח מכסה משותפת)
     openlibrary — Open Library של Internet Archive (אנגלית, ISBN, כריכות)
     nli         — הספרייה הלאומית (SRU על Alma, רשומת MARC) — המקור הרשמי לכל ספר שיצא בישראל (עותק חובה); בלי כריכות
     apple       — Apple Books (iTunes Search) — כריכות באיכות גבוהה ותקציר, בעיקר אנגלית
   מבנה אחיד: { src, id, title, subtitle, authors[], authorSort, publisher, date, year, lang, isbn, desc, tags[], series, seriesIndex, pages, cover }
   הפענוח טהור (נבדק בלי רשת). מידע ציבורי בלבד — לא נשלח שום נתון של המשתמש מלבד מה שחיפש. */

const UA = 'TheSnowball-Library/1.0 (personal reading app)';
const LANG3 = { heb: 'he', eng: 'en', ara: 'ar', rus: 'ru', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de', spa: 'es', yid: 'yi' };

const decodeXml = (s) => String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const stripHtml = (s) => decodeXml(String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
/* סימני פיסוק של קטלוג בסוף שדה (" :", " /", ",", ";") — לא נקודה אחרי ראשי תיבות */
function clean(s) {
  let t = String(s || '').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().replace(/[\s,:;/=]+$/, '').trim();
  if (/\.$/.test(t) && !/(^|\s)\S{1,2}\.$/.test(t)) t = t.slice(0, -1).trim();
  return t.replace(/^\[(.*)\]$/, '$1');
}
const yearOf = (s) => { const m = String(s || '').match(/\b(1[5-9]\d\d|20\d\d)\b/); return m ? +m[1] : 0; };
const isbnOf = (arr) => {
  const all = (arr || []).map((x) => String(x || '').replace(/[^0-9Xx]/g, '').toUpperCase()).filter((x) => x.length === 13 || x.length === 10);
  return all.find((x) => x.length === 13) || all[0] || '';
};
/* "רולינג, ג'יי. קיי." → "ג'יי. קיי. רולינג" (שם הקטלוג = שם המיון) */
function displayName(sortName) {
  const s = clean(sortName);
  const m = s.match(/^([^,]+),\s*(.+)$/);
  return m ? m[2] + ' ' + m[1] : s;
}
function rec(o) {
  return Object.assign({ src: '', id: '', title: '', subtitle: '', authors: [], authorSort: '', publisher: '', date: '', year: 0, lang: '', isbn: '', desc: '', tags: [], series: '', seriesIndex: '', pages: 0, cover: '' }, o);
}

/* ---------- Google Books ---------- */
function parseGoogle(j) {
  return ((j && j.items) || []).map((it) => {
    const v = it.volumeInfo || {};
    const ids = (v.industryIdentifiers || []).map((x) => x.identifier);
    let cover = (v.imageLinks && (v.imageLinks.extraLarge || v.imageLinks.large || v.imageLinks.medium || v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)) || '';
    if (cover) cover = cover.replace(/^http:/, 'https:').replace(/&edge=curl/, '') + (/[?&]fife=/.test(cover) ? '' : '&fife=w800-h1200');
    return rec({ src: 'google', id: it.id || '', title: clean(v.title), subtitle: clean(v.subtitle), authors: (v.authors || []).map(clean),
      publisher: clean(v.publisher), date: v.publishedDate || '', year: yearOf(v.publishedDate), lang: (v.language || '').slice(0, 2),
      isbn: isbnOf(ids), desc: stripHtml(v.description), tags: (v.categories || []).map(clean), pages: +v.pageCount || 0, cover });
  });
}
function googleUrl(q, key) {
  const parts = [];
  if (q.isbn) parts.push('isbn:' + q.isbn);
  else {
    if (q.title) parts.push('intitle:' + q.title);
    if (q.author) parts.push('inauthor:' + q.author);
  }
  let u = 'https://www.googleapis.com/books/v1/volumes?maxResults=8&printType=books&q=' + encodeURIComponent(parts.join(' '));
  if (key) u += '&key=' + encodeURIComponent(key);
  return u;
}

/* ---------- Open Library ---------- */
function parseOpenLibrary(j) {
  return ((j && j.docs) || []).map((d) => rec({ src: 'openlibrary', id: d.key || '', title: clean(d.title), subtitle: clean(d.subtitle),
    authors: (d.author_name || []).map(clean), publisher: clean((d.publisher || [])[0]), year: +d.first_publish_year || 0,
    date: d.first_publish_year ? String(d.first_publish_year) : '', lang: LANG3[(d.language || [])[0]] || '', isbn: isbnOf(d.isbn),
    tags: (d.subject || []).slice(0, 8).map(clean), series: clean((d.series || [])[0]), pages: +d.number_of_pages_median || 0,
    cover: d.cover_i ? 'https://covers.openlibrary.org/b/id/' + d.cover_i + '-L.jpg' : '' }));
}
function openLibraryUrl(q) {
  const f = '&fields=key,title,subtitle,author_name,publisher,first_publish_year,isbn,language,subject,cover_i,number_of_pages_median,series&limit=6';
  if (q.isbn) return 'https://openlibrary.org/search.json?isbn=' + encodeURIComponent(q.isbn) + f;
  return 'https://openlibrary.org/search.json?' + (q.title ? 'title=' + encodeURIComponent(q.title) : '') + (q.author ? '&author=' + encodeURIComponent(q.author) : '') + f;
}

/* ---------- הספרייה הלאומית (SRU → MARC21) ---------- */
function marcFields(recXml) {
  const out = {};
  const ctl = /<controlfield[^>]*tag="(\d+)"[^>]*>([\s\S]*?)<\/controlfield>/g;
  for (let m; (m = ctl.exec(recXml));) out[m[1]] = [decodeXml(m[2])];
  const df = /<datafield([^>]*)>([\s\S]*?)<\/datafield>/g;
  for (let m; (m = df.exec(recXml));) {
    const tag = (m[1].match(/tag="(\d+)"/) || [])[1]; if (!tag) continue;
    const subs = {};
    const sf = /<subfield code="(.)">([\s\S]*?)<\/subfield>/g;
    for (let s; (s = sf.exec(m[2]));) (subs[s[1]] = subs[s[1]] || []).push(decodeXml(s[2]));
    (out[tag] = out[tag] || []).push(subs);
  }
  return out;
}
function parseNli(xml) {
  const recs = String(xml || '').match(/<record xmlns="http:\/\/www\.loc\.gov\/MARC21\/slim">[\s\S]*?<\/record>/g) || [];
  return recs.map((r) => {
    const f = marcFields(r);
    const sub = (tag, code) => ((f[tag] || [])[0] || {})[code] ? f[tag][0][code][0] : '';
    const all = (tag, code) => (f[tag] || []).map((x) => (x[code] || [])[0]).filter(Boolean);
    const main = sub('100', 'a');
    const added = all('700', 'a');
    const names = [main].concat(added).filter(Boolean);
    const pub = sub('264', 'b') || sub('260', 'b');
    const yr = sub('264', 'c') || sub('260', 'c');
    const f008 = (f['008'] || [''])[0];
    const lang3 = sub('041', 'a') || f008.slice(35, 38);
    return rec({ src: 'nli', id: (f['001'] || [''])[0], title: clean(sub('245', 'a')), subtitle: clean(sub('245', 'b')),
      authors: names.map(displayName), authorSort: clean(main), publisher: clean(pub), year: yearOf(yr) || yearOf(f008.slice(7, 11)),
      date: String(yearOf(yr) || ''), lang: LANG3[lang3] || '', isbn: isbnOf(all('020', 'a')), desc: clean(sub('520', 'a')),
      tags: all('650', 'a').map(clean).slice(0, 8), series: clean(sub('490', 'a')), seriesIndex: clean(sub('490', 'v')),
      pages: +(String(sub('300', 'a')).match(/\d+/) || [0])[0] || 0 });
  }).filter((x) => x.title);
}
function nliUrl(q) {
  const esc = (s) => String(s).replace(/"/g, '');
  const parts = [];
  if (q.isbn) parts.push('alma.isbn=' + q.isbn);
  else {
    if (q.title) parts.push('alma.title="' + esc(q.title) + '"');
    if (q.author) parts.push('alma.creator="' + esc(q.author) + '"');
    if (q.lang === 'he') parts.push('alma.language=heb');   // הקטלוג לא ממיין לפי רלוונטיות — בלי זה מהדורות זרות (Sapiens) תופסות את הראש
  }
  return 'https://nli.alma.exlibrisgroup.com/view/sru/972NNL_INST?version=1.2&operation=searchRetrieve&recordSchema=marcxml&maximumRecords=20&query=' + encodeURIComponent(parts.join(' and '));
}

/* ---------- Apple Books ---------- */
function parseApple(j) {
  return ((j && j.results) || []).map((x) => rec({ src: 'apple', id: String(x.trackId || ''), title: clean(x.trackName), authors: x.artistName ? [clean(x.artistName)] : [],
    date: (x.releaseDate || '').slice(0, 10), year: yearOf(x.releaseDate), desc: stripHtml(x.description),
    tags: (x.genres || []).filter((g) => g !== 'Books').slice(0, 6), cover: (x.artworkUrl100 || '').replace(/\/\d+x\d+bb\./, '/1200x1200bb.') }));
}
function appleUrl(q) {
  const term = q.isbn ? q.isbn : [q.title, q.author].filter(Boolean).join(' ');
  return 'https://itunes.apple.com/search?media=ebook&entity=ebook&limit=6&country=' + (q.lang === 'he' ? 'il' : 'us') + '&term=' + encodeURIComponent(term);
}

/* ---------- קלט ---------- */
function normQuery(b) {
  const isbn = String((b && b.isbn) || '').replace(/[^0-9Xx]/g, '').toUpperCase();
  const cut = (s) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  const q = { isbn: isbn.length === 10 || isbn.length === 13 ? isbn : '', title: cut(b && b.title), author: cut(b && b.author), lang: /^(he|en)$/.test((b && b.lang) || '') ? b.lang : '' };
  if (!q.lang) q.lang = /[֐-׿]/.test(q.title + q.author) ? 'he' : 'en';
  return q.isbn || q.title ? q : null;
}

/* ---------- הרצה ---------- */
async function getJson(fetchImpl, url, ms) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ac.signal });
    if (r.status !== 200) {
      // אבחון: הודעת השגיאה של המקור (למשל "API key not valid" / "Books API has not been used in project") — בלי המפתח עצמו
      let why = '';
      try { const j = await r.json(); why = String((j && j.error && (j.error.status || j.error.message)) || '').replace(/key=[^&\s]+/g, 'key=…').slice(0, 60); } catch (e) {}
      throw new Error('http_' + r.status + (why ? ' ' + why : ''));
    }
    return await r.json();
  } finally { clearTimeout(t); }
}
async function getText(fetchImpl, url, ms) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetchImpl(url, { headers: { 'User-Agent': UA }, signal: ac.signal });
    if (r.status !== 200) throw new Error('http_' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}
async function searchAll(q, deps = {}) {
  const f = deps.fetch || fetch, ms = deps.timeout || 8000, key = deps.googleKey || '';
  const jobs = {
    nli: () => getText(f, nliUrl(q), ms).then(parseNli),
    google: () => getJson(f, googleUrl(q, key), ms).catch((e) => (/http_5\d\d/.test(e.message) ? getJson(f, googleUrl(q, key), ms) : Promise.reject(e))).then(parseGoogle),   // 503 רגעי — ניסיון אחד נוסף
    openlibrary: () => getJson(f, openLibraryUrl(q), ms).then(parseOpenLibrary),
    apple: () => getJson(f, appleUrl(q), ms).then(parseApple),
  };
  const names = Object.keys(jobs);
  const settled = await Promise.allSettled(names.map((n) => jobs[n]()));
  const results = [], status = {};
  settled.forEach((s, i) => {
    status[names[i]] = s.status === 'fulfilled' ? s.value.length : 'err:' + String((s.reason && s.reason.message) || s.reason).slice(0, 40);
    if (s.status === 'fulfilled') results.push(...s.value);
  });
  // תקציר מ־Open Library נמצא רק ברשומת היצירה — משלימים לתוצאה הראשונה
  const ol = results.find((r) => r.src === 'openlibrary' && !r.desc && /^\/works\//.test(r.id));
  if (ol) {
    try { const w = await getJson(f, 'https://openlibrary.org' + ol.id + '.json', 4000); const d = w.description; ol.desc = stripHtml(typeof d === 'string' ? d : (d && d.value) || ''); } catch (e) {}
  }
  // כריכה לספר עברי: לספרייה הלאומית אין כריכות, ו־Google לא תמיד מוצא לפי שם/כותב בעברית — מבקשים מ־Google לפי ה־ISBN של
  // שתי ההתאמות הראשונות של הקטלוג (המיזוג לפי ISBN מוסיף את הכריכה והתקציר)
  if (!deps.noEnrich) {
    const need = rank(results.slice(), q).filter((r) => r.src === 'nli' && r.isbn && !results.some((o) => o.src === 'google' && o.isbn === r.isbn)).slice(0, 2);
    const extra = await Promise.allSettled(need.map((r) => getJson(f, googleUrl({ isbn: r.isbn }, key), ms).then(parseGoogle)));
    extra.forEach((x) => { if (x.status === 'fulfilled') results.push(...x.value.slice(0, 1).map((g) => Object.assign(g, { enrich: 1 }))); });
  }
  // מדרגים הכל ואז עד 6 מכל מקור (אם חותכים לפני הדירוג — הקטלוג, שלא ממוין לפי רלוונטיות, מאבד את ההתאמות הטובות)
  const per = {};
  const ranked = rank(mergeByIsbn(results), q).filter((r) => !r.enrich && (per[r.src] = (per[r.src] || 0) + 1) <= 6);
  return { results: ranked, status };
}
/* כמו Calibre: אותו ספר (אותו ISBN) מכמה מקורות — כל רשומה מקבלת מהאחרות את מה שחסר לה (כריכה, תקציר, עמודים, הוצאה) */
function mergeByIsbn(list) {
  const by = {};
  list.forEach((r) => { if (r.isbn) (by[r.isbn] = by[r.isbn] || []).push(r); });
  Object.values(by).forEach((grp) => {
    if (grp.length < 2) return;
    grp.forEach((r) => grp.forEach((o) => {
      if (o === r) return;
      ['cover', 'desc', 'publisher', 'subtitle'].forEach((k) => { if (!r[k] && o[k]) r[k] = o[k]; });
      if (!r.pages && o.pages) r.pages = o.pages;
      if (!r.tags.length && o.tags.length) r.tags = o.tags.slice();
    }));
  });
  return list;
}
/* דירוג: ISBN זהה, כותר תואם, ובעברית — הספרייה הלאומית קודם; באנגלית — Google ואז Open Library */
function rank(list, q) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const qt = norm(q.title), qa = norm(q.author);
  const order = q.lang === 'he' ? { nli: 0, google: 1, openlibrary: 2, apple: 3 } : { google: 0, openlibrary: 1, apple: 2, nli: 3 };
  const score = (r) => {
    let s = 0;
    if (q.isbn && r.isbn === q.isbn) s += 100;
    const t = norm(r.title);
    if (qt && t === qt) s += 40; else if (qt && (t.includes(qt) || qt.includes(t))) s += 20;
    if (qa && r.authors.some((a) => norm(a).includes(qa) || qa.includes(norm(a)))) s += 15;
    if (r.cover) s += 3; if (r.desc) s += 2; if (r.isbn) s += 2;
    return s - order[r.src] * (q.lang === 'he' ? 6 : 2);   // בעברית — הקטלוג הרשמי קודם
  };
  return list.map((r) => Object.assign(r, { score: score(r) })).sort((a, b) => b.score - a.score);
}

/* כריכות — רק ממארחי המקורות (השרתון לא משמש פרוקסי כללי) */
const COVER_HOSTS = [/^books\.google\.com$/, /^books\.googleusercontent\.com$/, /^covers\.openlibrary\.org$/, /^(ia|archive)[a-z0-9.-]*\.archive\.org$/, /^archive\.org$/, /^is\d+-ssl\.mzstatic\.com$/];
function coverAllowed(u) {
  try { const x = new URL(u); return x.protocol === 'https:' && COVER_HOSTS.some((re) => re.test(x.hostname)); } catch (e) { return false; }
}

module.exports = { mergeByIsbn, searchAll, normQuery, parseGoogle, parseOpenLibrary, parseNli, parseApple, googleUrl, openLibraryUrl, nliUrl, appleUrl, rank, coverAllowed, displayName, clean, stripHtml };
