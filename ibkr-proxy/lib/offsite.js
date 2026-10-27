'use strict';
/* 11/10/2026 — גיבוי אצל ספק שני (החלטת המשתמש: ל־Google Drive שלו, בלי עלות ובלי חשבון חדש).
   למה: הגיבוי היומי (lib/backup.js) נשמר ב־R2 — באותו חשבון Cloudflare של הנתונים עצמם. חשבון שנחסם / נמחק / נפרץ
   = גם הנתונים וגם הגיבוי. כאן עותק ב־Drive של המנהל (Google — ספק אחר):
   - "ימים": קובצי הגיבוי של היום (Firestore התפעולי, שני הקטלוגים) + מילוני המונחים (gl/) — פעם ביום, נשמרים BK_KEEP ימים.
   - "ספרים וכריכות": קובצי המדף המשותף (lib/v2/f, lib/v2/c) — לפי md5, כלומר לא משתנים: מעלים רק מה שחסר, בהדרגה
     (תקציב זמן/גודל לכל ריצה), **ואף פעם לא מוחקים** — מחיקה המונית ב־R2 (בדיוק האסון שממנו מגנים) לא תתגלגל לגיבוי.
   לא נכנסים: התיק (users/* — רק ב־Firebase), הספרים הפרטיים (כבר ב־Drive של כל משתמש), סרטוני הסטודיו (זמניים).
   הכל דרך io מוזרק — נבדק בלי רשת (tests/offsite.test.js). */
const ROOT_NAME = 'THE SNOWBALL — גיבוי מערכת';
const DAYS_NAME = 'ימים';
const FILES_NAME = 'ספרים וכריכות';
const KEEP_DAYS = 14;
const FILE_PREFIXES = ['lib/v2/f/', 'lib/v2/c/'];
const RUN_MAX_FILES = 25;              // לכל ריצה (הקרון היומי + הבדיקה כל 10 דק׳ — מתכנס תוך שעות)
const RUN_MAX_BYTES = 48 * 1024 * 1024;
const FILE_MAX = 64 * 1024 * 1024;      // קובץ גדול מזה — מדלגים (ספר אמיתי קטן בהרבה)
const DAY = 864e5;

const dayOf = (now) => new Date(now).toISOString().slice(0, 10);
const baseName = (k) => String(k).split('/').pop();

/* טהורה: מה חסר בגיבוי — מפתחות R2 שאין להם קובץ ב־Drive (לפי snbK), עד התקציב. drive = Set של מפתחות */
function planFiles(r2, drive, maxFiles = RUN_MAX_FILES, maxBytes = RUN_MAX_BYTES) {
  const out = [];
  let bytes = 0, left = 0;
  for (const x of Array.isArray(r2) ? r2 : []) {
    if (!x || !x.key || drive.has(x.key) || !(x.size > 0) || x.size > FILE_MAX) continue;
    if (out.length >= maxFiles || (out.length && bytes + x.size > maxBytes)) { left++; continue; }
    out.push(x);
    bytes += x.size;
  }
  return { up: out, left };
}
/* טהורה: קובצי "ימים" ישנים מ־KEEP_DAYS (לפי snbD) — רק אלה נמחקים */
function expiredDays(files, now, keep = KEEP_DAYS) {
  const cut = dayOf(now - keep * DAY);
  return (Array.isArray(files) ? files : []).filter((f) => {
    const d = String((f && f.appProperties && f.appProperties.snbD) || '');
    return /^\d{4}-\d{2}-\d{2}$/.test(d) && d < cut;
  });
}

/* io = { r2: { list(prefix) → [{key,size}], get(key, max) → Buffer|null },
          drive: { folder(name, parentId, tag) → id, list(folderId) → [{id,name,size,appProperties}], upload(folderId, name, buf, mime, props) → id, trash(id) },
          clock() → ms }
   st = המצב הקודם ({day}) → מחזיר { ok, day, daily, up, left, gone, err } */
async function runOffsite(io, now, st, deadline) {
  st = st || {};
  const clock = io.clock || Date.now;
  const timeLeft = () => !deadline || clock() < deadline;
  const today = dayOf(now);
  const out = { ok: true, day: st.day || '', daily: 0, up: 0, left: 0, gone: 0 };
  const root = await io.drive.folder(ROOT_NAME, null, 'root');
  const days = await io.drive.folder(DAYS_NAME, root, 'days');
  const files = await io.drive.folder(FILES_NAME, root, 'files');

  // 1. פעם ביום — רק אחרי שהגיבוי של היום כבר ב־R2 (fs.json.gz נכתב אחרון ב־runBackup)
  if (st.day !== today) {
    const bk = await io.r2.list('bk/' + today + '/');
    if (bk.some((x) => baseName(x.key) === 'fs.json.gz')) {
      const extra = (await io.r2.list('gl/').catch(() => [])).concat(await io.r2.list('sm/').catch(() => []));   // 28/10/2026: + זיכרון הסדרה
      for (const x of bk.concat(extra)) {
        const buf = await io.r2.get(x.key, FILE_MAX);
        if (!buf) continue;
        const name = today + ' · ' + (x.key.startsWith('gl/') ? 'gl-' : x.key.startsWith('sm/') ? 'sm-' : '') + baseName(x.key);
        await io.drive.upload(days, name, buf, /\.gz$/.test(x.key) ? 'application/gzip' : 'text/plain', { snbK: x.key, snbD: today });
        out.daily++;
      }
      for (const f of expiredDays(await io.drive.list(days), now)) { await io.drive.trash(f.id); out.gone++; }
      out.day = today;
    }
  }
  // 2. בהדרגה — קובצי המדף המשותף שעוד לא בגיבוי (אף פעם לא מוחקים)
  if (timeLeft()) {
    let r2 = [];
    for (const p of FILE_PREFIXES) r2 = r2.concat(await io.r2.list(p));
    const have = new Set((await io.drive.list(files)).map((f) => String((f.appProperties && f.appProperties.snbK) || '')).filter(Boolean));
    const plan = planFiles(r2, have);
    out.left = plan.left;
    for (const x of plan.up) {
      if (!timeLeft()) { out.left++; continue; }
      const buf = await io.r2.get(x.key, FILE_MAX);
      if (!buf) continue;
      await io.drive.upload(files, baseName(x.key), buf, 'application/octet-stream', { snbK: x.key });
      out.up++;
    }
  }
  return out;
}

/* Drive דרך fetch עם גישה זמנית (drive.file — רואים רק את מה שהלקוח יצר). כל קריאה עם בדיקת סטטוס */
const FOLDER_MT = 'application/vnd.google-apps.folder';
function driveIo(fetchFn, token) {
  const H = { Authorization: 'Bearer ' + token };
  const api = 'https://www.googleapis.com/drive/v3/';
  const j = async (url, opt) => {
    const r = await fetchFn(url, Object.assign({}, opt || {}, { headers: Object.assign({}, H, (opt && opt.headers) || {}) }));
    if (r.status < 200 || r.status >= 300) throw new Error('gd_http_' + r.status);
    return r.status === 204 ? {} : r.json();
  };
  const q = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  async function list(folderId, extraQ) {
    const out = [];
    let pt = '';
    for (let i = 0; i < 20; i++) {
      const qs = new URLSearchParams({ q: (folderId ? "'" + q(folderId) + "' in parents and " : '') + 'trashed=false' + (extraQ ? ' and ' + extraQ : ''),
        fields: 'nextPageToken,files(id,name,size,appProperties)', pageSize: '1000', spaces: 'drive' });
      if (pt) qs.set('pageToken', pt);
      const r = await j(api + 'files?' + qs);
      out.push(...(Array.isArray(r.files) ? r.files : []));
      if (!r.nextPageToken) break;
      pt = String(r.nextPageToken);
    }
    return out;
  }
  async function folder(name, parentId, tag) {
    const found = await list(parentId, "mimeType='" + FOLDER_MT + "' and appProperties has { key='snbSys' and value='" + q(tag) + "' }");
    if (found.length) return found[0].id;
    const meta = { name, mimeType: FOLDER_MT, appProperties: { snbSys: tag } };
    if (parentId) meta.parents = [parentId];
    return (await j(api + 'files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meta) })).id;
  }
  async function upload(folderId, name, buf, mime, props) {
    const meta = { name, parents: [folderId], appProperties: props || {} };
    const r = await fetchFn('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
      method: 'POST', headers: Object.assign({}, H, { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(buf.length) }),
      body: JSON.stringify(meta) });
    const loc = r.headers.get('location');
    if (r.status !== 200 || !loc || !/^https:\/\/www\.googleapis\.com\/upload\//.test(loc)) throw new Error('gd_http_' + r.status);
    const p = await fetchFn(loc, { method: 'PUT', headers: { 'Content-Type': mime }, body: buf });
    if (p.status !== 200 && p.status !== 201) throw new Error('gd_http_' + p.status);
    return (await p.json()).id;
  }
  const trash = (id) => j(api + 'files/' + encodeURIComponent(id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
  return { list, folder, upload, trash };
}

/* הגישה ל־Drive של בעל הגיבוי — רק דרך הלקוח של הספרייה (driveVault). הלקוח של הסטודיו לא מתאים: העובד בענן מקבל גישה שלו,
   ו־drive.file = כל מה שהלקוח יצר — עובד שנפרץ היה רואה ויכול למחוק את הגיבוי */
function ownerToken(deps, uid) {
  return require('./gdrive').accessToken(deps, uid);
}

module.exports = { ownerToken, ROOT_NAME, KEEP_DAYS, FILE_PREFIXES, RUN_MAX_FILES, RUN_MAX_BYTES, FILE_MAX, dayOf, planFiles, expiredDays, runOffsite, driveIo };
