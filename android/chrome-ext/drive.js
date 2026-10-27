// הקבצים של הסנכרון ב־Google Drive של המשתמש — בתיקייה המוסתרת של האפליקציה (appDataFolder): רק Studio Browser
// והתוסף (אותו פרויקט ב־Google Cloud) רואים אותה; לא בשרת שלנו. הרשאה: drive.appdata בלבד.
const API = 'https://www.googleapis.com/drive/v3/files';
const UP = 'https://www.googleapis.com/upload/drive/v3/files';

export function token(interactive) {
  return new Promise((res, rej) => {
    chrome.identity.getAuthToken({ interactive: !!interactive }, (t) => {
      const e = chrome.runtime.lastError;
      if (e || !t) rej(new Error(e ? e.message : 'no_token')); else res(typeof t === 'string' ? t : t.token);
    });
  });
}

export async function forget() {
  try { const t = await token(false); await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(t), { method: 'POST' }); } catch (e) {}
  await new Promise((r) => chrome.identity.clearAllCachedAuthTokens(r));
}

async function call(t, url, init = {}) {
  const r = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: 'Bearer ' + t } });
  if (r.status === 401) { await new Promise((ok) => chrome.identity.removeCachedAuthToken({ token: t }, ok)); throw new Error('auth'); }
  if (!r.ok) throw new Error('drive_' + r.status);
  return r;
}

// כמה קבצים באותו שם (מרוץ, ניסיון חוזר) — תמיד הראשון שנוצר, כדי ששני הצדדים יקראו ויכתבו את אותו קובץ
export async function find(t, name) {
  const q = encodeURIComponent(`name='${name}' and trashed=false`);
  const r = await call(t, `${API}?spaces=appDataFolder&q=${q}&orderBy=createdTime&fields=files(id,modifiedTime,appProperties)&pageSize=10`);
  const j = await r.json();
  return (j.files || [])[0] || null;
}

export async function readJson(t, name) {
  const f = await find(t, name);
  if (!f) return null;
  const r = await call(t, `${API}/${f.id}?alt=media`);
  try { return await r.json(); } catch (e) { return null; }
}

/** `props` = appProperties (w = איזה Chrome כתב). מעל 4MB — העלאה מתחדשת (העלאה רגילה מוגבלת ל־5MB) */
export async function writeJson(t, name, obj, props, found) {
  const body = JSON.stringify(obj);
  const f = found === undefined ? await find(t, name) : found;
  const meta = f ? { appProperties: props || {} } : { name, parents: ['appDataFolder'], appProperties: props || {} };
  if (new Blob([body]).size > 4 * 1024 * 1024) {
    const r = await call(t, f ? `${UP}/${f.id}?uploadType=resumable` : `${UP}?uploadType=resumable`, {
      method: f ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/json' }, body: JSON.stringify(meta) });
    const loc = r.headers.get('Location');
    if (!loc) throw new Error('drive_upload');
    await call(t, loc, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
    return;
  }
  const b = 'snb' + Date.now();
  const multi = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`;
  await call(t, f ? `${UP}/${f.id}?uploadType=multipart` : `${UP}?uploadType=multipart`, { method: f ? 'PATCH' : 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: multi });
}
