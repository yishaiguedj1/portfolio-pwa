/* גיבוי הספרייה הפרטית ל־Google Drive של המשתמש (v318, בקשת המשתמש 04/10/2026 — "כמו וואטסאפ").
   הטלפון מעלה ומוריד ישירות מ־Drive עם גישה זמנית (שעה); השרתון רק מחזיק את ההרשאה הקבועה (refresh token),
   מוצפנת בכספת (lib/vault.js, AES-256-GCM, AAD = gdrive|uid|r) במסמך driveVault/{uid} — ולעולם לא מחזיר אותה לטלפון.
   הרשאה: drive.file בלבד — האפליקציה רואה רק קבצים שהיא עצמה יצרה (התיקייה "THE SNOWBALL — הספרייה שלי"), לא את שאר הדרייב.
   משתני סביבה ב־Vercel: GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET (לקוח OAuth מסוג Web באותו פרויקט Google).
   משתנה חדש נכנס רק בבנייה חדשה של השרתון — Redeploy של פריסה שדולגה (ignoreCommand, קומיט שלא נוגע בשרתון) לא בונה.
   פעולות (כל אחת עם התחברות Firebase מאומתת):
     gdConfig → { clientId, configured }      (בלי התחברות — הלקוח ציבורי)
     gdStatus → { connected, email }
     gdConnect { code, redirect } → { access_token, expires_in, email }   (הקוד מחלון ההסכמה של Google)
     gdToken → { access_token, expires_in, email } | error:'revoked'
     gdDisconnect → ביטול ההרשאה אצל Google + מחיקת הרשומה */
const vault = require('./vault');
const { datastoreToken } = require('./gauth');

const SCOPE_FILE = 'https://www.googleapis.com/auth/drive.file';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';
const COL = () => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents/driveVault';
const UID_RE = /^[A-Za-z0-9]{6,128}$/;
/* כתובת החזרה מותרת — רק עמוד oauth.html של האפליקציה (או localhost לפיתוח) */
const REDIRECT_RE = /^(https:\/\/yishaiguedj1\.github\.io\/portfolio-pwa\/oauth\.html|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/(?:[\w.-]+\/)*oauth\.html)$/;
const AAD = (uid) => 'gdrive|' + uid + '|r';

function cfg() {
  return { id: String(process.env.GDRIVE_CLIENT_ID || '').trim(), secret: String(process.env.GDRIVE_CLIENT_SECRET || '').trim() };
}
const configured = () => { const c = cfg(); return !!(c.id && c.secret && vault.configured()); };

async function fsReq(deps, method, uid, body) {
  const tk = await datastoreToken(deps.fetch);
  const r = await (deps.fetch || fetch)(COL() + '/' + uid, { method, headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j };
}
async function readRec(deps, uid) {
  const r = await fsReq(deps, 'GET', uid);
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
  const f = (r.j && r.j.fields) || {};
  return vault.open((f.r || {}).stringValue || '', AAD(uid));
}
async function writeRec(deps, uid, rec) {
  const r = await fsReq(deps, 'PATCH', uid, { fields: { r: { stringValue: vault.seal(rec, AAD(uid)) }, at: { integerValue: String(Date.now()) }, v: { integerValue: '1' } } });
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
}
const delRec = (deps, uid) => fsReq(deps, 'DELETE', uid);

function form(o) { return Object.entries(o).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&'); }
async function tokenCall(deps, params) {
  const r = await (deps.fetch || fetch)(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(params) });
  let j = {}; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j };
}
/* ה־id_token מגיע ישירות מ־Google (TLS, שרת לשרת) — מספיק לקרוא ממנו את המייל */
function emailOf(idt) {
  try { const p = JSON.parse(Buffer.from(String(idt).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); return String(p.email || ''); } catch (e) { return ''; }
}
const revoke = (deps, token) => (deps.fetch || fetch)(REVOKE_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ token }) }).catch(() => null);

async function handle(body, user, res, deps = {}) {
  if (!UID_RE.test(String(user.uid || ''))) return res.status(401).json({ ok: false, error: 'no_auth' });
  if (!configured()) return res.status(503).json({ ok: false, error: 'gd_not_configured', diag: { id: !!cfg().id, secret: !!cfg().secret, vault: vault.configured() } });
  const uid = user.uid, c = cfg();
  try {
    if (body.op === 'gdStatus') {
      const rec = await readRec(deps, uid);
      return res.status(200).json({ ok: true, connected: !!(rec && rec.rt), email: rec ? rec.email || '' : '' });
    }
    if (body.op === 'gdConnect') {
      const code = String(body.code || ''), redirect = String(body.redirect || '');
      if (!code || code.length > 512 || !REDIRECT_RE.test(redirect)) return res.status(400).json({ ok: false, error: 'bad_params' });
      const t = await tokenCall(deps, { code, client_id: c.id, client_secret: c.secret, redirect_uri: redirect, grant_type: 'authorization_code' });
      if (t.status !== 200 || !t.j.access_token) return res.status(400).json({ ok: false, error: 'gd_' + String(t.j.error || 'code').slice(0, 24) });
      const scopes = String(t.j.scope || '').split(/\s+/);
      if (!scopes.includes(SCOPE_FILE)) {      // המשתמש הוריד את הסימון של Drive בחלון ההסכמה
        await revoke(deps, t.j.access_token);
        return res.status(400).json({ ok: false, error: 'gd_no_scope' });
      }
      const old = await readRec(deps, uid).catch(() => null);
      const rt = t.j.refresh_token || (old && old.rt) || '';
      if (!rt) return res.status(400).json({ ok: false, error: 'gd_no_refresh' });
      const email = emailOf(t.j.id_token) || (old && old.email) || '';
      await writeRec(deps, uid, { rt, email, at: Date.now() });
      return res.status(200).json({ ok: true, access_token: t.j.access_token, expires_in: t.j.expires_in || 3600, email });
    }
    if (body.op === 'gdToken') {
      const rec = await readRec(deps, uid);
      if (!rec || !rec.rt) return res.status(200).json({ ok: false, error: 'not_connected' });
      const t = await tokenCall(deps, { refresh_token: rec.rt, client_id: c.id, client_secret: c.secret, grant_type: 'refresh_token' });
      if (t.status === 400 && t.j.error === 'invalid_grant') {   // המשתמש ביטל את הגישה בחשבון Google — מנקים
        await delRec(deps, uid);
        return res.status(200).json({ ok: false, error: 'revoked' });
      }
      if (t.status !== 200 || !t.j.access_token) return res.status(502).json({ ok: false, error: 'gd_http_' + t.status });
      return res.status(200).json({ ok: true, access_token: t.j.access_token, expires_in: t.j.expires_in || 3600, email: rec.email || '' });
    }
    if (body.op === 'gdDisconnect') {
      const rec = await readRec(deps, uid).catch(() => null);
      if (rec && rec.rt) await revoke(deps, rec.rt);
      const r = await delRec(deps, uid);
      return res.status(r.status === 200 || r.status === 404 ? 200 : 502).json({ ok: r.status === 200 || r.status === 404 });
    }
    return res.status(400).json({ ok: false, error: 'bad_op' });
  } catch (e) {
    return res.status(502).json({ ok: false, error: /^(fs_http_|sa_http_|vault_)/.test(String(e.message)) ? String(e.message).slice(0, 30) : 'failed' });
  }
}

module.exports = { handle, configured, cfg, REDIRECT_RE, SCOPE_FILE, emailOf };
