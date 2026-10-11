'use strict';
/* פרויקט בן־יהודה (מנהל הספרייה ס׳8, 11/10/2026; מחקר 04): 26 אלף יצירות ברשות הרבים בעברית.
   הקטלוג = pseudocatalogue.csv מה־dump הפתוח שלהם ב־GitHub (ID, כותר, יוצרים, מתרגמים, סוגה); ה־ID = מזהה ההורדה:
   benyehuda.org/download/<ID>.epub → 302 → active_storage → 302 → S3 (בלי CORS — לכן דרך השרתון) — נבדק.
   כאן רק פענוח וחיפוש (טהור); ההורדה ב־libmgr (ישר לקובץ זמני ב־R2, כמו העלאה מהטלפון). */

const CAT_URL = 'https://raw.githubusercontent.com/projectbenyehuda/public_domain_dump/master/pseudocatalogue.csv';
const GENRE = { poetry: 'שירה', article: 'מאמרים', prose: 'פרוזה', reference: 'עיון', memoir: 'זכרונות', letters: 'מכתבים', fables: 'משלים', drama: 'מחזות', lexicon: 'מילונים' };

/* CSV (RFC 4180: מרכאות, מרכאות כפולות, שורות בתוך שדה) */
function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const strip = (s) => String(s || '').replace(/[֑-ׇ]/g, '').replace(/[‎‏‪-‮]/g, '');
const fold = (s) => strip(s).toLowerCase().replace(/[׳'"״]/g, '').replace(/[ךםןףץ]/g, (c) => ({ 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' })[c]).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/* הקטלוג → [{ id, t: כותר, a: יוצרים, tr: מתרגמים, g: סוגה, k: מחרוזת חיפוש }] */
function parseCatalog(text) {
  const rows = parseCsv(text);
  const head = rows.shift() || [];
  const ix = (n) => head.indexOf(n);
  const I = { id: ix('ID'), t: ix('title'), a: ix('authors'), tr: ix('translators'), g: ix('genre') };
  if (I.id < 0 || I.t < 0) return [];
  const out = [];
  for (const r of rows) {
    const id = +r[I.id];
    if (!Number.isInteger(id) || id <= 0) continue;
    const t = String(r[I.t] || '').trim().slice(0, 200);
    if (!t) continue;
    const a = String(r[I.a] || '').trim().slice(0, 200), tr = String(r[I.tr] || '').trim().slice(0, 200);
    const gm = /\.([a-z]+)$/.exec(String(r[I.g] || ''));
    out.push({ id, t, a, tr, g: gm ? GENRE[gm[1]] || '' : '', k: fold(t + ' ' + a + ' ' + tr) });
  }
  return out;
}
/* חיפוש: כל המילים; יוצר שהשם שלו זהה לשאילתה — ראשון (כך "כל היצירות של ביאליק" = שאילתה אחת) */
function search(list, q, max = 60, genre = '') {
  const w = fold(q).split(' ').filter((x) => x.length >= 2);
  if (!w.length) return { total: 0, items: [] };
  const fq = fold(q);
  const hits = list.filter((x) => (!genre || x.g === genre) && w.every((t) => x.k.includes(t)));
  const rank = (x) => { const a = fold(x.a); return a === fq ? 3 : w.every((t) => a.includes(t)) ? 2 : 0; };   // היוצר עצמו לפני יצירות שמזכירות אותו
  hits.sort((x, y) => rank(y) - rank(x) || x.t.localeCompare(y.t, 'he'));
  return { total: hits.length, items: hits.slice(0, max).map((x) => ({ id: x.id, t: strip(x.t), a: strip(x.a), tr: strip(x.tr), g: x.g })) };
}
/* מארחים שמותר לעבור דרכם בהורדה (הפניות ידניות — כל יעד נבדק לפני הבקשה, בלי SSRF) */
function dlAllowed(u) {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && (x.hostname === 'benyehuda.org' || /^[a-z0-9.-]+\.s3[a-z0-9.-]*\.amazonaws\.com$/.test(x.hostname) || /^s3[a-z0-9.-]*\.amazonaws\.com$/.test(x.hostname));
  } catch (e) { return false; }
}
const dlUrl = (id) => 'https://benyehuda.org/download/' + (+id) + '.epub';

module.exports = { CAT_URL, GENRE, parseCsv, parseCatalog, search, dlAllowed, dlUrl, fold };
