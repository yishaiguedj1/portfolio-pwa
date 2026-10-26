'use strict';
/* ת7: גיבוי יומי — המצב התפעולי ב־Firestore (הסטודיו והאקדמיה) + קטלוג הספרייה (הישן וזה של מנהל הספרייה) → R2 (`bk/<תאריך>/`), נשמר 14 יום.
   רץ מהקרון היומי של Vercel ומהניטור (watch). אידמפוטנטי: יש כבר גיבוי להיום = לא עושים כלום, ולכן קריאות חוזרות זולות
   (HEAD אחד). הסדר: קודם הקטלוג ואז Firestore — הקובץ של Firestore הוא הסימן ש"היום גובה", ונכתב אחרון.
   **לא נכנסים** לגיבוי: הכספות (מוצפנות; מתחדשות בחיבור מחדש), מטמון ה־AI ומונה השימוש, ו־users/* (התיק — החלטת פרטיות:
   נתונים אישיים רק ב־Firestore של המשתמש). שחזור: ידני — readBackup נותן לכל אוסף את המסמכים בפורמט של Firestore
   (name, fields, ut), שנכתבים בחזרה ב־PATCH כמו שהם. */
const zlib = require('zlib');

const BK_COLS = ['studioJobs', 'studioStats', 'studioOps', 'studioServers', 'studioUp', 'academy'];
const BK_KEEP = 14;                // ימים
const BK_MAX_DOCS = 3000;          // לכל אוסף (עמודים של 300)
const CAT_KEY = 'lib/catalog.json';
const CAT2_KEY = 'lib/v2/cat.json.gz';     // ס׳9: הקטלוג של מנהל הספרייה (כבר דחוס — נשמר כמו שהוא)
const CAT_MAX = 8 * 1024 * 1024;
const DAY = 864e5;

const bkDate = (now) => new Date(now).toISOString().slice(0, 10);
const bkKey = (date) => 'bk/' + date + '/fs.json.gz';
const bkCatKey = (date) => 'bk/' + date + '/catalog.json.gz';
const bkCat2Key = (date) => 'bk/' + date + '/cat2.json.gz';
const bkDnsKey = (date) => 'bk/' + date + '/dns.txt.gz';   // 26/10/2026: רשומות הדומיין (lib/dnsexport.js)

/* טהורה: המפתחות של גיבויים שעברו את תקופת השמירה (לפי התאריך שבנתיב; מפתח בצורה אחרת — לא נוגעים) */
function bkExpired(keys, now, keep = BK_KEEP) {
  const cut = bkDate(now - keep * DAY);
  return (Array.isArray(keys) ? keys : []).filter((k) => {
    const m = /^bk\/(\d{4}-\d{2}-\d{2})\/[A-Za-z0-9._-]+$/.exec(String(k || ''));
    return !!m && m[1] < cut;
  });
}

/* io = { listCol(col, max) → [{name, fields, updateTime}], head(key), get(key, max), put(key, buf, type), list(prefix), del(key), dns?() → טקסט|null } */
async function putDns(io, date) {
  if (!io.dns) return false;
  const txt = await io.dns().catch(() => null);
  if (!txt) return false;
  await io.put(bkDnsKey(date), zlib.gzipSync(Buffer.from(txt, 'utf8')), 'application/gzip');
  return true;
}
async function runBackup(io, now) {
  const date = bkDate(now), key = bkKey(date);
  if (await io.head(key)) {
    // הגיבוי של היום כבר נעשה — אולי במופע בלי טוקן של Cloudflare (השרת שלנו). משלימים את רשומות הדומיין אם חסרות
    let dns = false;
    if (io.dns && !(await io.head(bkDnsKey(date)).catch(() => true))) dns = await putDns(io, date).catch(() => false);
    return { ok: true, done: false, date, dns };
  }
  const cat = await io.get(CAT_KEY, CAT_MAX).catch(() => null);
  if (cat) await io.put(bkCatKey(date), zlib.gzipSync(cat), 'application/gzip');
  const cat2 = await io.get(CAT2_KEY, CAT_MAX).catch(() => null);
  if (cat2) await io.put(bkCat2Key(date), cat2, 'application/gzip');
  const dns = await putDns(io, date).catch(() => false);
  const out = { v: 1, at: now, cols: {} };
  let n = 0;
  for (const c of BK_COLS) {
    const docs = await io.listCol(c, BK_MAX_DOCS);
    out.cols[c] = docs;
    n += docs.length;
  }
  const buf = zlib.gzipSync(Buffer.from(JSON.stringify(out), 'utf8'));
  await io.put(key, buf, 'application/gzip');
  let gone = 0;
  try {
    for (const k of bkExpired((await io.list('bk/')).map((x) => x.key), now)) { await io.del(k); gone++; }
  } catch (e) {}
  return { ok: true, done: true, date, n, b: buf.length, cat: !!cat, cat2: !!cat2, dns, gone };
}

/* קריאת גיבוי (לשחזור / לבדיקה) */
function readBackup(buf) {
  const j = JSON.parse(zlib.gunzipSync(buf).toString('utf8'));
  if (!j || j.v !== 1 || !j.cols || typeof j.cols !== 'object') throw new Error('bad_backup');
  return j;
}

module.exports = { BK_COLS, BK_KEEP, BK_MAX_DOCS, bkDate, bkKey, bkCatKey, bkCat2Key, bkDnsKey, bkExpired, runBackup, readBackup };
