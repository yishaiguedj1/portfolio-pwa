'use strict';
/* מנוע ההתאמה (מנהל הספרייה ס׳6, 11/10/2026; מחקר 05) — טהור, בלי רשת. לכל ספר במדף: מועמדים מהמאגרים (bookmeta.searchAll)
   → ציון ביטחון 0–1 לכל מועמד עם "למה" → הטוב ביותר + שדות ממוזגים לפי סדר עדיפויות לשפה → דלי: אוטומטי / לבדיקה / לא נמצא.
   עקרונות (מהמחקר): ISBN זהה = כמעט ודאי; בלי ISBN — כותר ‎.55 · מחבר ‎.25 · שפה ‎.08 · שנה ‎.07 · הוצאה ‎.05 (כמו Picard);
   עברית: ניקוד, אותיות סופיות, תחיליות כחלופה (לא הסרה — "משקיע" מתחיל ב־מ), שלד בלי אמות קריאה (כתיב מלא/חסר);
   מחברים בין כתבים (באפט ~ Buffett) — מפתח עיצורים משותף, רק כאות תומך; הכרעה אוטומטית תמיד דורשת גם כותר. */

const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or']);
const HE = /[א-ת]/;

/* ---------------- ISBN */
function isbnValid(s) {
  if (/^\d{13}$/.test(s)) { let t = 0; for (let i = 0; i < 13; i++) t += +s[i] * (i % 2 ? 3 : 1); return t % 10 === 0; }
  if (/^\d{9}[\dX]$/.test(s)) { let t = 0; for (let i = 0; i < 10; i++) t += (s[i] === 'X' ? 10 : +s[i]) * (10 - i); return t % 11 === 0; }
  return false;
}
/* ISBN‑13 תקין (10 → 13), או ריק */
function isbn13(x) {
  const s = String(x || '').toUpperCase().replace(/[^0-9X]/g, '');
  if (!isbnValid(s)) return '';
  if (s.length === 13) return s;
  const b = '978' + s.slice(0, 9);
  let t = 0; for (let i = 0; i < 12; i++) t += +b[i] * (i % 2 ? 3 : 1);
  return b + ((10 - (t % 10)) % 10);
}

/* ---------------- נרמול */
function norm(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[֑-ׇ]/g, '').replace(/[‎‏‪-‮⁦-⁩]/g, '')
    .replace(/[׳’`]/g, "'").replace(/[״”“]/g, '"').toLowerCase()
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/\[[^\]]*\]/g, ' ').replace(/\((?:[^)]*edition|rev\.? ?ed)[^)]*\)/g, ' ').replace(/\brev\.? ?ed\.?\b/g, ' ')
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/'/g, '').replace(/\s+/g, ' ').trim();
}
const toks = (s) => norm(s).split(' ').filter((t) => t && !STOP.has(t));
const skel = (t) => (HE.test(t) ? t[0] + t.slice(1).replace(/[אויה]/g, '') : t.replace(/(?!^)[aeiouy]/g, ''));
const PRE2 = ['וה', 'שה', 'מה', 'לה', 'בה', 'כש', 'וב', 'ול', 'ומ', 'וש', 'שב', 'של'];
function alts(t) {                       // חלופות תחילית: "והחרב" ~ "החרב" ~ "חרב" (רק כשנשארות 3 אותיות לפחות)
  const out = [t];
  if (!HE.test(t)) return out;
  if (t.length > 3 && 'והבכלמש'.includes(t[0])) out.push(t.slice(1));
  if (t.length > 4 && PRE2.includes(t.slice(0, 2))) out.push(t.slice(2));
  return out;
}
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const ratio = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);
function tokSim(a, b) {
  if (a === b) return 1;
  const A = alts(a), B = alts(b);
  if (A.some((x) => B.includes(x))) return 0.95;
  if (A.some((x) => B.some((y) => skel(x) === skel(y) && skel(x).length >= 2))) return 0.95;
  if (a.length > 5 && b.length > 5) { const r = ratio(skel(a), skel(b)); if (r >= 0.75) return 0.95 * r; }
  return 0;
}

/* ---------------- דמיון כותרים */
function segments(s) {                   // הכותר המלא, לפני ":", לפני "/", ואחרי "N -" ("השרביט והחרב 18 - עקצן")
  const raw = String(s || '');
  const out = [raw];
  const c = raw.split(/\s*[:/]\s*/)[0]; if (c && c !== raw) out.push(c);
  const m = /^.*?\d+\s*[-–‑]\s*(.+)$/.exec(raw); if (m) out.push(m[1]);
  return out.map(toks).filter((t) => t.length);
}
function dice(A, B) {
  const used = new Set(); let s = 0;
  for (const a of A) {
    let best = 0, bj = -1;
    B.forEach((b, j) => { if (used.has(j)) return; const v = tokSim(a, b); if (v > best) { best = v; bj = j; } });
    if (bj >= 0) { used.add(bj); s += best; }
  }
  return (2 * s) / (A.length + B.length);
}
function prefixIn(A, B) {                // הקצר הוא תחילת הארוך (כותר משנה) — לפי הסדר
  const [S, L] = A.length <= B.length ? [A, B] : [B, A];
  let s = 0;
  for (let i = 0; i < S.length; i++) { const v = tokSim(S[i], L[i]); if (!v) return 0; s += v; }
  return s / S.length;
}
function titleSim(a, b) {
  let best = 0;
  for (const A of segments(a)) for (const B of segments(b)) best = Math.max(best, dice(A, B), 0.9 * prefixIn(A, B));
  return Math.round(best * 1000) / 1000;
}

/* ---------------- מחברים (גם בין עברית לאנגלית) */
function heKey(t) {
  let s = t.replace(/^וו/, 'ב').replace(/^ו/, 'ב').replace(/וו/g, 'ב').replace(/ג'/g, 'J').replace(/צ'/g, 'C').replace(/ז'/g, 'J');
  const map = { 'ב': 'B', 'ג': 'G', 'ד': 'D', 'ז': 'Z', 'ח': 'H', 'ט': 'T', 'ת': 'T', 'כ': 'K', 'ק': 'K', 'ל': 'L', 'מ': 'M', 'נ': 'N', 'ס': 'S', 'ש': 'S', 'פ': 'P', 'צ': 'C', 'ר': 'R' };
  let out = '';
  for (let i = 0; i < s.length; i++) { const c = s[i]; if (/[A-Z]/.test(c)) out += c; else if (map[c]) out += map[c]; }
  return out.replace(/(.)\1+/g, '$1');
}
function enKey(t) {
  const s = t.toLowerCase().replace(/ph/g, 'f').replace(/th/g, 't').replace(/sch|sh/g, 's').replace(/ts|tz|ch/g, 'c').replace(/ck/g, 'k').replace(/x/g, 'ks');
  const map = { b: 'B', v: 'B', w: 'B', f: 'P', p: 'P', t: 'T', d: 'D', k: 'K', c: 'K', q: 'K', g: 'G', j: 'J', l: 'L', m: 'M', n: 'N', s: 'S', z: 'Z', r: 'R' };
  let out = '';
  for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === 'c' && s[i - 1] !== undefined && /[ei]/.test(s[i + 1] || '')) out += 'S'; else if (map[c]) out += map[c]; }
  return out.replace(/(.)\1+/g, '$1');
}
const nkey = (t) => (HE.test(t) ? heKey(t) : enKey(t)).replace(/Z/g, 'C');
function nameToks(name) {
  const s = String(name || '');
  const m = /^([^,]+),\s*(.+)$/.exec(s);           // "באפט, וורן" → וורן באפט
  return toks(m ? m[2] + ' ' + m[1] : s).filter((t) => !/^\d+$/.test(t));
}
function nTokSim(a, b) {
  if (a.length === 1 || b.length === 1) return a[0] === b[0] ? 0.9 : (nkey(a)[0] && nkey(a)[0] === nkey(b)[0] ? 0.8 : 0);   // ראשי תיבות
  if (HE.test(a) === HE.test(b)) return Math.max(tokSim(a, b), ratio(skel(a), skel(b)) >= 0.85 ? ratio(skel(a), skel(b)) : 0);
  const ka = nkey(a), kb = nkey(b);
  return ka && kb ? 0.95 * ratio(ka, kb) : 0;
}
function nameSim(x, y) {
  const A = nameToks(x), B = nameToks(y);
  if (!A.length || !B.length) return 0;
  const [S, L] = A.length <= B.length ? [A, B] : [B, A];
  const sims = S.map((t) => Math.max(...L.map((u) => nTokSim(t, u))));
  const full = S.filter((t) => t.length > 1).map((t, i) => sims[S.indexOf(t)]);
  const sur = full.length ? Math.max(...full) : Math.max(...sims);
  const rest = sims.filter((v, i) => v !== sur || sims.indexOf(v) !== i);
  if (!rest.length) return Math.round(sur * 1000) / 1000;
  const other = rest.reduce((a, b) => a + b, 0) / rest.length;
  let s = 0.7 * sur + 0.3 * other;
  const bothFirst = S.filter((t) => t.length > 1).length > 1 && L.filter((t) => t.length > 1).length > 1;
  if (bothFirst && other < 0.5) s *= 0.6;          // "מרי באפט" ≠ "וורן באפט"
  return Math.round(s * 1000) / 1000;
}
function authorSim(qa, ca) {
  let best = 0;
  for (const a of qa || []) for (const b of ca || []) best = Math.max(best, nameSim(a, b));
  return best;
}

/* ---------------- ציון ביטחון */
const W = { T: 0.55, A: 0.25, L: 0.08, Y: 0.07, P: 0.05 };
function quality(c) {
  if (c.src === 'nli') return c.isbn || c.year ? 1 : 0.8;          // רשומה מקוצרת ("בהמתנה להפקדת חובה")
  if (c.src === 'google') return c.isbn ? 0.95 : 0.9;
  if (c.src === 'openlibrary') return 0.9;
  if (c.src === 'apple') return 0.85;
  return 0.85;
}
/* q = { isbns:[], title, authors:[], lang, year, publisher }; c = רשומה מ־bookmeta. מחזיר { conf, why, I } */
function score(q, c) {
  const why = [];
  const ci = isbn13(c.isbn);
  const I = q.isbns.length && ci ? (q.isbns.includes(ci) ? 1 : 0) : null;
  const T = Math.max(titleSim(q.title, c.title), c.subtitle ? titleSim(q.title, c.title + ': ' + c.subtitle) : 0);
  const A = q.authors.length && c.authors.length ? authorSim(q.authors, c.authors) : null;
  const L = q.lang && c.lang ? (q.lang === c.lang ? 1 : 0) : null;
  const Y = q.year && c.year ? (Math.abs(q.year - c.year) <= 1 ? 1 : Math.abs(q.year - c.year) <= 3 ? 0.6 : 0.2) : null;
  const P = q.publisher && c.publisher ? (norm(c.publisher).includes(norm(q.publisher)) || norm(q.publisher).includes(norm(c.publisher)) ? 1 : 0) : null;
  let conf;
  if (I === 1) { conf = T < 0.5 ? 0.5 : 0.8 + 0.2 * T; why.push('isbn'); }
  else {
    let sw = 0, s = 0;
    for (const [k, v] of Object.entries({ T, A, L, Y, P })) if (v != null) { sw += W[k]; s += W[k] * v; }
    conf = sw ? s / sw : 0;
  }
  conf *= quality(c);
  if (T < 0.6) conf = Math.min(conf, 0.5);
  if (A != null && A < 0.5) conf *= 0.6;
  if (L === 0) conf *= 0.7;
  if (I === 0) conf *= 0.85;
  if (toks(q.title).length <= 1 && A == null) conf = Math.min(conf, 0.8);
  why.push('title ' + T.toFixed(2));
  if (A != null) why.push('author ' + A.toFixed(2));
  if (L != null) why.push(L ? 'lang' : 'lang≠');
  if (I === 0) why.push('isbn≠');
  return { conf: Math.round(conf * 1000) / 1000, why, I, T, A };
}
const bucketOf = (c) => (c >= 0.9 ? 'auto' : c >= 0.65 ? 'review' : 'none');

/* ---------------- שדות: מה מכל מועמד, לפי שפה */
const ORDER = { he: ['nli', 'google', 'openlibrary', 'apple'], en: ['google', 'openlibrary', 'apple', 'nli'] };
const EDITION = ['isbn', 'pub', 'date'];
function fieldsOf(c) {
  return { title: c.title || '', subtitle: c.subtitle || '', author: (c.authors || []).join(', '), authorSort: c.authorSort || '',
    pub: c.publisher || '', date: c.date || (c.year ? String(c.year) : ''), lang: c.lang || '', isbn: isbn13(c.isbn) || '',
    desc: c.desc || '', tags: (c.tags || []).join(', '), series: c.series || '', seriesIdx: c.seriesIndex ? String(c.seriesIndex) : '' };
}
/* ספר אחד: q + מועמדים → { conf, bucket, why, src, f, prov, covers, alts } */
function matchBook(q, cands) {
  const scored = (cands || []).map((c) => Object.assign({ c }, score(q, c))).sort((a, b) => b.conf - a.conf);
  if (!scored.length) return { conf: 0, bucket: 'none', why: [], f: {}, prov: {}, covers: [], alts: [] };
  const top = scored[0];
  // אותה יצירה: ISBN משותף, או כותר ומחבר כמעט זהים — מהן משלימים שדות חסרים וכריכות
  const same = scored.filter((s) => s === top || (isbn13(s.c.isbn) && isbn13(s.c.isbn) === isbn13(top.c.isbn)) || (titleSim(s.c.title, top.c.title) >= 0.9 && (!s.c.authors.length || !top.c.authors.length || authorSim(s.c.authors, top.c.authors) >= 0.85)));
  const order = ORDER[q.lang === 'he' ? 'he' : 'en'];
  same.sort((a, b) => (a === top ? -1 : b === top ? 1 : order.indexOf(a.c.src) - order.indexOf(b.c.src)));
  const f = {}, prov = {};
  const editionOk = (s) => s.I === 1 || (!q.isbns.length && (!q.lang || !s.c.lang || q.lang === s.c.lang) && s === top);
  for (const s of same) {
    const g = fieldsOf(s.c);
    for (const k of Object.keys(g)) {
      if (f[k] || !g[k]) continue;
      if (EDITION.includes(k) && !editionOk(s)) continue;        // הוצאה / תאריך / ISBN — רק מאותה מהדורה
      f[k] = g[k]; prov[k] = s.c.src === 'openlibrary' ? 'ol' : s.c.src;
    }
  }
  const covers = [];
  for (const s of same) if (s.c.cover && !covers.some((x) => x.url === s.c.cover)) covers.push({ url: s.c.cover, src: s.c.src === 'openlibrary' ? 'ol' : s.c.src });
  // היתרון מול "יצירה אחרת": מועמד הכי טוב שאינו מאותה יצירה
  const other = scored.find((s) => !same.includes(s));
  let bucket = bucketOf(top.conf);
  if (bucket === 'auto' && other && top.conf - other.conf < 0.05) bucket = 'review';
  const alts = scored.slice(1, 5).map((s) => ({ src: s.c.src, title: s.c.title, authors: s.c.authors.slice(0, 3), year: s.c.year || 0, isbn: isbn13(s.c.isbn), conf: s.conf, cover: s.c.cover || '' }));
  return { conf: top.conf, bucket, why: top.why, src: top.c.src === 'openlibrary' ? 'ol' : top.c.src, f, prov, covers: covers.slice(0, 6), alts };
}
/* ספר מהקטלוג → שאילתה (ISBN תקין בלבד; מחברים מפוצלים) */
function queryOf(b) {
  const isbns = [isbn13(b.isbn)].filter(Boolean);
  const year = (/\b(1[5-9]\d\d|20\d\d)\b/.exec(String(b.date || '')) || [])[1];
  const lang = /^he|^iw|^heb/i.test(b.lang || '') ? 'he' : /^en/i.test(b.lang || '') ? 'en' : (/[א-ת]/.test(String(b.title || '') + (b.author || '')) ? 'he' : 'en');
  return { isbns, title: String(b.title || '').slice(0, 300), authors: String(b.author || '').split(/\s*(?:,|&| and | ו־)\s*/).filter(Boolean).slice(0, 4),
    lang, year: year ? +year : 0, publisher: String(b.pub || '') };
}

module.exports = { isbn13, isbnValid, norm, titleSim, nameSim, authorSim, score, matchBook, queryOf, bucketOf, fieldsOf };
