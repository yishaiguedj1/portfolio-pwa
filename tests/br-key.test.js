// 27/10/2026 — Studio Browser: מפתח ההצפנה של הסנכרון בין המכשירים (op:'brKey' ב־api/studio.js, vault.derive).
// הנתונים ב־Google Drive של המשתמש מוצפנים במפתח שרק מי שמחובר לחשבון שלו במערכת שלנו מקבל: אותו משתמש = אותו מפתח
// (בכל מכשיר, ב־Vercel ובשרת שלנו — נגזר מחשבון השירות), משתמש אחר = מפתח אחר, בלי התחברות — 401, טוקן של אפליקציה אחרת — 403.
// הרצה: node tests/br-key.test.js
const path = require('path');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');

(async () => {
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, {
    GDRIVE_SA_KEY: JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    SNB_SITEWATCH: 'off', SNB_ADMINWATCH: 'off', SNB_FUNDWATCH: 'off',
  });
  delete process.env.IBKR_VAULT_KEY;
  const gauth = require(path.join(root, 'ibkr-proxy/lib/gauth.js'));
  const vault = require(path.join(root, 'ibkr-proxy/lib/vault.js'));
  const studio = require(path.join(root, 'ibkr-proxy/api/studio.js'));
  gauth._reset(); studio._reset();
  const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tnow = Math.floor(Date.now() / 1000);
  const tok = (sub, extra = {}) => {
    const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u(Object.assign({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub, iat: tnow - 5, exp: tnow + 3000, email: sub + '@example.com', email_verified: true }, extra));
    return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url');
  };
  let fetched = 0;
  const deps = () => ({ verify: { keys }, fetch: async () => { fetched++; return { status: 404, ok: false, json: async () => ({}), text: async () => '' }; }, now: Date.now() });
  const call = async (body) => {
    const res = { code: 0, j: null, setHeader() {}, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, end() { return res; } };
    await studio._handler({ method: 'POST', query: {}, body, headers: {}, socket: { remoteAddress: '9.9.9.9' } }, res, deps());
    return res;
  };

  ok((await call({ op: 'brKey' })).code === 401, 'בלי התחברות — 401');
  ok((await call({ op: 'brKey', idToken: 'x.y.z' })).code === 401, 'טוקן לא תקין — 401');
  ok((await call({ op: 'brKey', idToken: tok('brUserA00001', { app: 'invest' }) })).j.error === 'wrong_app', 'טוקן של Invest — 403 wrong_app');
  const a1 = await call({ op: 'brKey', idToken: tok('brUserA00001') });
  const a2 = await call({ op: 'brKey', idToken: tok('brUserA00001', { app: 'studio' }) });
  const b1 = await call({ op: 'brKey', idToken: tok('brUserB00002') });
  ok(a1.code === 200 && a1.j.ok && Buffer.from(a1.j.k, 'base64').length === 32 && a1.j.kid === 's', 'מפתח של 32 בתים, נגזר מחשבון השירות');
  ok(a1.j.k === a2.j.k, 'אותו משתמש — אותו מפתח (מכשיר שני מקבל אותו)');
  ok(b1.j.k !== a1.j.k, 'משתמש אחר — מפתח אחר');
  ok(fetched === 0, 'בלי Firestore ובלי אף פנייה לרשת');
  // לא המפתח של הכספת עצמו: מה שהכספת הצפינה לא נפתח במפתח שנמסר
  const sealed = vault.seal({ x: 1 }, 'aad');
  const [, , ivs, cts] = sealed.split('.');
  const all = Buffer.from(cts, 'base64url');
  let opened = true;
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(a1.j.k, 'base64'), Buffer.from(ivs, 'base64url'));
    d.setAAD(Buffer.from('snb-ibkr-vault|v1|aad')); d.setAuthTag(all.subarray(all.length - 16));
    Buffer.concat([d.update(all.subarray(0, all.length - 16)), d.final()]);
  } catch (e) { opened = false; }
  ok(!opened, 'המפתח שנמסר הוא לא המפתח של הכספת');
  // מפתח ייעודי (IBKR_VAULT_KEY) שנוסף אחר כך לא משנה את המפתח של המשתמשים (s גובר)
  process.env.IBKR_VAULT_KEY = crypto.randomBytes(32).toString('base64');
  studio._reset();
  const a3 = await call({ op: 'brKey', idToken: tok('brUserA00001') });
  ok(a3.j.k === a1.j.k && a3.j.kid === 's', 'הוספת IBKR_VAULT_KEY לא מחליפה את המפתח');
  delete process.env.GDRIVE_SA_KEY; gauth._reset(); studio._reset();
  const a4 = await call({ op: 'brKey', idToken: tok('brUserA00001') });
  ok(a4.code === 200 && a4.j.kid === 'e', 'בלי חשבון שירות — המפתח הייעודי');
  console.log('br-key: ' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
