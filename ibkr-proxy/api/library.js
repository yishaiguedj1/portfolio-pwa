/* האקדמיה (שלב 2): POST /api/library
     { op:'list', idToken }            -> { ok, items:[{ id, name, size, md5, modified }] }
     { op:'file', idToken, id }        -> הקובץ עצמו (application/epub+zip)
   המכתבים יושבים בתיקייה ב־Drive של המשתמש (LIBRARY_FOLDER_ID), משותפת לחשבון שירות (GDRIVE_SA_KEY) לקריאה בלבד.
   כל בקשה: התחברות Firebase מאומתת + הקורא ברשימת ההרשאות (LIBRARY_READERS). קובץ נשלח רק אם הוא בתיקייה
   (או בתת־תיקייה אחת מתחתיה — למשל תיקייה לכל מנכ"ל), כך שאי אפשר לבקש דרך השרתון קובץ אחר שמשותף לחשבון. */
const { guard } = require('../lib/ibkr');
const { verifyIdToken, readerAllowed, driveToken, serviceAccount } = require('../lib/gauth');
const { epubText } = require('../lib/epubtext');
const { insight } = require('../lib/insight');
const insightCache = new Map();   // id|md5 → ניתוח (חוסך קריאות ל־Gemini בין קוראים, כל עוד המופע חי)

const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const BOOK_RE = /\.(epub|azw3|azw|mobi|kf8|fb2)$/i;
const ID_RE = /^[A-Za-z0-9_-]{10,100}$/;
const LIST_TTL = 60 * 1000;
const MAX_FILE = 4 * 1024 * 1024; // מגבלת התשובה של Vercel ~4.5MB; מכתב טיפוסי ~60KB

let listCache = { at: 0, items: null, folders: null };
/* LIBRARY_FOLDER_ID: מזהה התיקייה — או הקישור המלא אליה (drive.google.com/drive/folders/<ID>?usp=sharing) */
function folderId(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/folders\/([A-Za-z0-9_-]{10,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : s;
}
const hits = new Map();
function limited(key, max) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < 60000);
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

async function driveGet(path, token, fetchImpl) {
  const r = await (fetchImpl || fetch)(DRIVE + path, { headers: { Authorization: 'Bearer ' + token } });
  if (r.status !== 200) throw new Error('drive_http_' + r.status);
  return r;
}
const q = (s) => encodeURIComponent(s);
const FLAGS = '&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1000';

async function listAll(fetchImpl) {
  if (listCache.items && Date.now() - listCache.at < LIST_TTL) return listCache;
  const root = folderId(process.env.LIBRARY_FOLDER_ID);
  const token = await driveToken(fetchImpl);
  const fields = q('files(id,name,size,md5Checksum,modifiedTime,mimeType)');
  const inFolder = async (id) => (await (await driveGet('?q=' + q("'" + id + "' in parents and trashed=false") + '&fields=' + fields + FLAGS, token, fetchImpl)).json()).files || [];
  const top = await inFolder(root);
  const subs = top.filter((f) => f.mimeType === 'application/vnd.google-apps.folder').slice(0, 30);
  const nested = (await Promise.all(subs.map((s) => inFolder(s.id)))).flat();
  const items = top.concat(nested).filter((f) => BOOK_RE.test(f.name || '') && +f.size <= MAX_FILE)
    .map((f) => ({ id: f.id, name: f.name, size: +f.size || 0, md5: f.md5Checksum || '', modified: f.modifiedTime || '' }));
  listCache = { at: Date.now(), items, folders: new Set([root].concat(subs.map((s) => s.id))) };
  return listCache;
}

async function handler(req, res, deps = {}) {
  if (guard(req, res)) return;
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  if (!serviceAccount() || !process.env.LIBRARY_FOLDER_ID) {
    // אבחון בלי לחשוף ערכים: איזה משתנה חסר / לא נקרא
    const raw = String(process.env.GDRIVE_SA_KEY || '').trim();
    return res.status(503).json({ ok: false, error: 'not_configured', diag: {
      saKey: !raw ? 'missing' : serviceAccount() ? 'ok' : (raw.startsWith('{') ? 'bad_json' : 'bad_format') + ':' + raw.length,
      folder: process.env.LIBRARY_FOLDER_ID ? 'ok' : 'missing', readers: process.env.LIBRARY_READERS ? 'ok' : 'missing' } });
  }
  if (body.op === 'health') { // בדיקת הגדרה בלי התחברות: רק האם הרובוט ניגש לתיקייה וכמה מכתבים יש בה — בלי שמות
    try { const cat = await listAll(deps.fetch); return res.status(200).json({ ok: true, count: cat.items.length }); } catch (e) {
      return res.status(502).json({ ok: false, error: String(e && e.message || e).slice(0, 40) });
    }
  }
  let user;
  try { user = await verifyIdToken(body.idToken, deps.verify || {}); } catch (e) {
    return res.status(401).json({ ok: false, error: 'no_auth', why: String(e.message || e).slice(0, 40) });
  }
  if (!readerAllowed(user)) return res.status(403).json({ ok: false, error: 'not_allowed', email: user.email });
  if (limited(user.uid, 200)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  try {
    const cat = await listAll(deps.fetch);
    if (body.op === 'list') return res.status(200).json({ ok: true, items: cat.items });
    if (body.op === 'file' || body.op === 'insight') {
      const id = String(body.id || '');
      const item = cat.items.find((f) => f.id === id);
      if (!ID_RE.test(id) || !item) return res.status(404).json({ ok: false, error: 'not_found' });
      const ckey = id + '|' + item.md5;
      if (body.op === 'insight' && insightCache.has(ckey)) return res.status(200).json({ ok: true, insight: insightCache.get(ckey), md5: item.md5 });
      const token = await driveToken(deps.fetch);
      const meta = await (await driveGet('/' + id + '?fields=' + q('parents,size,name') + '&supportsAllDrives=true', token, deps.fetch)).json();
      if (!(meta.parents || []).some((p) => cat.folders.has(p))) return res.status(404).json({ ok: false, error: 'not_found' });
      const r = await driveGet('/' + id + '?alt=media&supportsAllDrives=true', token, deps.fetch);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > MAX_FILE) return res.status(413).json({ ok: false, error: 'too_large' });
      if (body.op === 'insight') {
        if (limited('ins|' + user.uid, 12)) return res.status(429).json({ ok: false, error: 'rate_limited' });
        let doc; try { doc = epubText(buf); } catch (e) { return res.status(422).json({ ok: false, error: 'not_epub' }); }
        if (doc.text.length < 500) return res.status(422).json({ ok: false, error: 'no_text' });
        const diag = {};
        const out = await (deps.insight || insight)(doc.title || meta.name, doc.text, deps.fetch, diag);
        if (!out.insight) return res.status(out.error === 'quota' ? 429 : 502).json({ ok: false, error: out.error, diag });
        insightCache.set(ckey, out.insight);
        if (insightCache.size > 300) insightCache.clear();
        return res.status(200).json({ ok: true, insight: out.insight, md5: item.md5 });
      }
      res.setHeader('Content-Type', 'application/epub+zip');
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).send(buf);
    }
    return res.status(400).json({ ok: false, error: 'bad_params' });
  } catch (e) {
    const m = String(e && e.message || e);
    return res.status(502).json({ ok: false, error: /^(drive_http_|sa_http_|not_configured)/.test(m) ? m : 'drive_failed' });
  }
}

module.exports = (req, res) => handler(req, res);
module.exports._handler = handler;
module.exports._folderId = folderId;
module.exports._reset = () => { listCache = { at: 0, items: null, folders: null }; hits.clear(); insightCache.clear(); };
