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
     gdDisconnect → ביטול ההרשאה אצל Google + מחיקת הרשומה
   v357 — לסטודיו התרגום לקוח OAuth נפרד (gdrive.studio): STUDIO_GDRIVE_CLIENT_ID/SECRET, רשומה ב־studioDrive/{uid} (AAD sdrive|uid|r).
   עם drive.file כל לקוח רואה רק את הקבצים שהוא יצר — העובד בענן (שמעבד תמלילים, תוכן לא מהימן) לא מגיע לגיבוי הספרייה.
   משתני הסטודיו הוגדרו ב־Vercel ב־07/10/2026.
   17/11/2026 — הסוד של הלקוח (הספרייה בסטודיו לא נטענה: Google החזיר invalid_client לסוד שבסביבת השרת):
     norm — מנקה מהערך בסביבה מירכאות, רווחים ותווי כיוון/רוחב אפס (סוד והמזהה של Google הם רק [A-Za-z0-9_-.]).
     סוד חלופי בכספת — studioVault/_gdc, שדה לכל לקוח (AAD gdclient|<שם>), גובר על הסביבה. נכתב רק אחרי בדיקה חיה מול
       Google (setSecret, מנהל בלבד), כך שאפשר להחליף סוד בלי Rescue ובלי הקמה מחדש. הסוד לא חוזר לעולם לטלפון.
     check — בדיקה עצמית בלי משתמש: בקשת חידוש עם הרשאה מזויפת. invalid_grant = הלקוח והסוד תקינים; invalid_client =
       סוד שגוי ("not found" = אין לקוח כזה). רק הסיווג יוצא החוצה. */
const vault = require('./vault');
const { datastoreToken } = require('./gauth');

const SCOPE_FILE = 'https://www.googleapis.com/auth/drive.file';
const SCOPE_RO = 'https://www.googleapis.com/auth/drive.readonly';   // 26/10/2026: רשימת הקבצים של Studio (gdrive.browse)
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';
const UID_RE = /^[A-Za-z0-9]{6,128}$/;
/* כתובת החזרה מותרת — רק עמוד oauth.html של האפליקציה (או localhost לפיתוח) */
/* כתובת החזרה מחלון ההסכמה — רק עמוד oauth.html של האפליקציה: github.io, הכתובות של THE SNOWBALL (ייצור וניסוי, לכל
   אפליקציה — שלב 4, 13/10/2026: בלי זה החיבור ל־Drive מ־academy-staging וכו' נדחה), או localhost. הכתובת חייבת להיות
   רשומה גם בלקוח ה־OAuth ב־Google Cloud */
const REDIRECT_RE = /^(https:\/\/yishaiguedj1\.github\.io\/portfolio-pwa\/oauth\.html|https:\/\/(?:(?:invest|academy|studio)(?:-staging)?\.|staging\.)?thesnowball\.app\/oauth\.html|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/(?:[\w.-]+\/)*oauth\.html)$/;

/* מזהה וסוד של Google — בלי מירכאות, רווחים ותווים בלתי נראים (סימני כיוון מהדבקה בעברית, BOM, רוחב אפס) */
const norm = (v) => String(v == null ? '' : v).replace(/[\p{Cf}\s]/gu, '').replace(/^["'`]+|["'`]+$/g, '');
const SECRET_RE = /^[A-Za-z0-9_-]{20,100}$/;
const PROBE_RT = '1//0snb-self-check';   // הרשאה מזויפת לבדיקה העצמית — Google בודק קודם את הלקוח והסוד
const NAMES = ['library', 'studio', 'browse'];
const OV_DOC = '_gdc', OV_TTL = 10 * 60e3, CK_TTL = 5 * 60e3;
const OV_URL = () => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents/studioVault/' + OV_DOC;
const ovAad = (n) => 'gdclient|' + n;
/* הסודות מהכספת (שם → סוד), במטמון 10 דק׳. תקלה בקריאה לא מפילה כלום: נשאר מה שהיה, וניסיון חוזר בעוד דקה */
let ov = { at: 0, v: {} };
const resets = [];   // לבדיקות: _reset מנקה את המטמונים (כמו אתחול של השרת)
async function ovLoad(deps, force) {
  const now = Date.now();
  if (!force && ov.at && now - ov.at < OV_TTL) return ov.v;
  try {
    const tk = await datastoreToken(deps.fetch);
    const r = await (deps.fetch || fetch)(OV_URL(), { method: 'GET', headers: { Authorization: 'Bearer ' + tk } });
    if (r.status === 404) { ov = { at: now, v: {} }; return ov.v; }
    if (r.status !== 200) throw new Error('fs_http_' + r.status);
    let j = null; try { j = await r.json(); } catch (e) {}
    const f = (j && j.fields) || {}, v = {};
    for (const n of NAMES) {
      const o = f[n] && f[n].stringValue ? vault.open(f[n].stringValue, ovAad(n)) : null;
      if (o && typeof o.s === 'string' && SECRET_RE.test(o.s)) v[n] = o.s;
    }
    ov = { at: now, v };
  } catch (e) { ov = { at: now - OV_TTL + 60e3, v: ov.v }; }
  return ov.v;
}
/* הבדיקה העצמית: מה Google אומר על המזהה והסוד (בלי שום משתמש) */
async function probe(deps, id, secret) {
  if (!id) return 'no_id';
  if (!secret) return 'missing';
  let t;
  try { t = await tokenCall(deps, { grant_type: 'refresh_token', refresh_token: PROBE_RT, client_id: id, client_secret: secret }); } catch (e) { return 'net'; }
  const er = String((t.j && t.j.error) || ''), d = String((t.j && t.j.error_description) || '');
  if (er === 'invalid_grant') return 'ok';
  if (er === 'invalid_client') return /not found/i.test(d) ? 'no_client' : 'bad_secret';
  if (er === 'invalid_request' && /secret/i.test(d)) return 'missing';
  return 'http_' + t.status;
}

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

/* לקוח OAuth אחד: מאיפה המזהה והסוד, איפה ההרשאה הקבועה נשמרת, ובאיזה AAD היא מוצפנת */
function makeDrive(o) {
  const OP = o.op || 'gd', NEED = o.scope || SCOPE_FILE;   // שמות הפעולות (gd… / gb…) וההרשאה שחייבת להינתן
  const COL = () => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents/' + o.col;
  const AAD = (uid) => o.aad + '|' + uid + '|r';
  // הסוד מהכספת גובר על הסביבה (ovLoad — לפני כל שימוש); src רק לאבחון
  const cfg = () => { const s = ov.v[o.name]; return { id: norm(process.env[o.idEnv]), secret: s || norm(process.env[o.secretEnv]), src: s ? 'vault' : 'env' }; };
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

  /* גישה זמנית (שעה) מההרשאה הקבועה (בסטודיו: העלאה מהטלפון; הורדה והעלאה בעובד בענן) */
  async function accessToken(deps, uid) {
    await ovLoad(deps);
    if (!configured()) return { ok: false, error: 'gd_not_configured' };
    const rec = await readRec(deps, uid);
    if (!rec || !rec.rt) return { ok: false, error: 'not_connected' };
    const c = cfg();
    const t = await tokenCall(deps, { refresh_token: rec.rt, client_id: c.id, client_secret: c.secret, grant_type: 'refresh_token' });
    if (t.status === 400 && t.j.error === 'invalid_grant') {   // המשתמש ביטל את הגישה בחשבון Google — מנקים
      await delRec(deps, uid);
      return { ok: false, error: 'revoked' };
    }
    // why — קוד השגיאה של Google (למשל invalid_client), אותיות בלבד: מה לתקן בהגדרות, בלי פרטים אישיים
    if (t.status !== 200 || !t.j.access_token) return { ok: false, error: 'gd_http_' + t.status, why: String((t.j && t.j.error) || '').replace(/[^a-z_]/g, '').slice(0, 40) };
    const expiresIn = t.j.expires_in || 3600;
    return { ok: true, token: t.j.access_token, expiresIn, exp: Date.now() + expiresIn * 1000, email: rec.email || '' };
  }
  /* האם Drive מחובר (בלי לבקש גישה) */
  async function driveState(deps, uid) {
    await ovLoad(deps);
    if (!configured()) return { configured: false, connected: false, email: '' };
    const rec = await readRec(deps, uid);
    return { configured: true, connected: !!(rec && rec.rt), email: rec ? rec.email || '' : '' };
  }

  async function handle(body, user, res, deps = {}) {
    if (!UID_RE.test(String(user.uid || ''))) return res.status(401).json({ ok: false, error: 'no_auth' });
    await ovLoad(deps);
    if (!configured()) return res.status(503).json({ ok: false, error: 'gd_not_configured', diag: { id: !!cfg().id, secret: !!cfg().secret, vault: vault.configured() } });
    const uid = user.uid, c = cfg();
    try {
      if (body.op === OP + 'Status') {
        const rec = await readRec(deps, uid);
        return res.status(200).json({ ok: true, connected: !!(rec && rec.rt), email: rec ? rec.email || '' : '' });
      }
      if (body.op === OP + 'Connect') {
        const code = String(body.code || ''), redirect = String(body.redirect || ''), verifier = body.verifier == null ? '' : String(body.verifier);
        if (!code || code.length > 512 || !REDIRECT_RE.test(redirect) || (verifier && !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier))) return res.status(400).json({ ok: false, error: 'bad_params' });
        // PKCE: הקוד הונפק עם code_challenge — Google מחליף אותו רק עם ה־verifier מהטלפון (קוד שיורט — לא שמיש, גם דרך השרתון).
        // גרסה ישנה של האפליקציה (בלי PKCE) — עדיין עובדת עד שהיא מתעדכנת
        const t = await tokenCall(deps, Object.assign({ code, client_id: c.id, client_secret: c.secret, redirect_uri: redirect, grant_type: 'authorization_code' }, verifier ? { code_verifier: verifier } : {}));
        if (t.status !== 200 || !t.j.access_token) return res.status(400).json({ ok: false, error: 'gd_' + String(t.j.error || 'code').slice(0, 24) });
        const scopes = String(t.j.scope || '').split(/\s+/);
        if (!scopes.includes(NEED)) {      // המשתמש הוריד את הסימון של Drive בחלון ההסכמה
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
      if (body.op === OP + 'Token') {
        const t = await accessToken(deps, uid);
        // 17/11/2026: 200 ולא 502 — דרך Cloudflare תשובת 502 הגיעה לטלפון בלי CORS ("Failed to fetch"), והקוד האמיתי אבד
        if (!t.ok) return res.status(200).json({ ok: false, error: t.error, why: t.why || '' });
        return res.status(200).json({ ok: true, access_token: t.token, expires_in: t.expiresIn, email: t.email });
      }
      if (body.op === OP + 'Disconnect') {
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

  /* הבדיקה העצמית של הלקוח הזה — במטמון 5 דק׳ (גם כשהיא ציבורית אין יותר מבקשה אחת ל־Google ב־5 דק׳).
     st: ok | bad_secret | no_client | missing | no_id | net | http_N · src: vault/env · fix: הניקוי שינה את הערך בסביבה */
  let ck = { at: 0, v: null };
  resets.push(() => { ck = { at: 0, v: null }; });
  async function check(deps, force) {
    const now = Date.now();
    if (!force && ck.v && now - ck.at < CK_TTL) return ck.v;
    await ovLoad(deps);
    const c = cfg(), raw = String(process.env[o.secretEnv] || '');
    const v = { st: await probe(deps, c.id, c.secret), src: c.src, fix: !!raw && norm(raw) !== raw.trim() };
    ck = { at: now, v };
    return v;
  }
  /* סוד חדש מהמנהל: ניקוי, צורה, בדיקה חיה מול Google — ורק אז שמירה מוצפנת (שדה של הלקוח הזה בלבד) */
  async function setSecret(deps, raw) {
    const s = norm(raw);
    if (!SECRET_RE.test(s)) return { ok: false, error: 'bad_format' };
    if (!vault.configured()) return { ok: false, error: 'vault_not_configured' };
    const id = cfg().id;
    if (!id) return { ok: false, error: 'gd_not_configured' };
    const st = await probe(deps, id, s);
    if (st !== 'ok') return { ok: false, error: st };
    const tk = await datastoreToken(deps.fetch);
    const q = '?updateMask.fieldPaths=' + o.name + '&updateMask.fieldPaths=at_' + o.name;
    const r = await (deps.fetch || fetch)(OV_URL() + q, { method: 'PATCH', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { [o.name]: { stringValue: vault.seal({ s }, ovAad(o.name)) }, ['at_' + o.name]: { integerValue: String(Date.now()) } } }) });
    if (r.status !== 200) return { ok: false, error: 'store' };
    ov = { at: Date.now(), v: Object.assign({}, ov.v, { [o.name]: s }) };
    ck = { at: 0, v: null };
    return { ok: true };
  }

  return { handle, configured, cfg, accessToken, driveState, check, setSecret };
}

const library = makeDrive({ name: 'library', idEnv: 'GDRIVE_CLIENT_ID', secretEnv: 'GDRIVE_CLIENT_SECRET', col: 'driveVault', aad: 'gdrive' });
const studio = makeDrive({ name: 'studio', idEnv: 'STUDIO_GDRIVE_CLIENT_ID', secretEnv: 'STUDIO_GDRIVE_CLIENT_SECRET', col: 'studioDrive', aad: 'sdrive' });
/* 26/10/2026 (בקשת המשתמש): לבחור סרטון מ־Drive ברשימה בעיצוב של Studio, בלי Google Picker — צריך לראות את הקבצים (drive.readonly).
   לקוח שלישי, נפרד: ההרשאה הרחבה לא מגיעה לחיבור של הסטודיו (שהעובד ב־Routine מקבל). הגישה לשעה — לטלפון (הרשימה),
   ולעובד רק בעבודה במצב השרת שהמקור שלה נבחר כך (op:'token' עם src — api/studio.js), רק בשביל הקובץ הזה.
   המשתנים (STUDIO_BROWSE_CLIENT_ID/SECRET) ב־Vercel נטענים רק בבנייה עם שינוי ב־ibkr-proxy/ — Redeploy נעצר ב־ignore-build.sh */
const browse = makeDrive({ name: 'browse', idEnv: 'STUDIO_BROWSE_CLIENT_ID', secretEnv: 'STUDIO_BROWSE_CLIENT_SECRET', col: 'studioBrowse', aad: 'sbrowse', op: 'gb', scope: SCOPE_RO });

module.exports = Object.assign({}, library, { studio, browse, makeDrive, REDIRECT_RE, SCOPE_FILE, SCOPE_RO, emailOf, norm,
  _reset: () => { ov = { at: 0, v: {} }; for (const f of resets) f(); } });
