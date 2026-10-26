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

export async function find(t, name) {
  const q = encodeURIComponent(`name='${name}' and trashed=false`);
  const r = await call(t, `${API}?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&pageSize=5`);
  const j = await r.json();
  return (j.files || [])[0] || null;
}

export async function readJson(t, name) {
  const f = await find(t, name);
  if (!f) return null;
  const r = await call(t, `${API}/${f.id}?alt=media`);
  try { return await r.json(); } catch (e) { return null; }
}

export async function writeJson(t, name, obj) {
  const body = JSON.stringify(obj);
  const f = await find(t, name);
  if (f) { await call(t, `${UP}/${f.id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body }); return; }
  const b = 'snb' + Date.now();
  const meta = JSON.stringify({ name, parents: ['appDataFolder'] });
  const multi = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`;
  await call(t, `${UP}?uploadType=multipart`, { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: multi });
}
