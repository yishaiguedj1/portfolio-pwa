/* כספת IBKR (סנכרון ברקע): הצפנה מאומתת לכל מה שנשמר בענן — ה־token, ה־Query ID והדוחות.
   AES-256-GCM (סודיות + שלמות), IV אקראי של 96 ביט לכל הצפנה, ו־AAD שקושר כל ערך למשתמש ולשדה —
   ערך מוצפן שהועתק למשתמש אחר / לשדה אחר לא ייפתח. המפתח לעולם לא נשמר ב־Firestore:
   IBKR_VAULT_KEY (32 בתים ב־base64, משתנה סביבה ב־Vercel) אם הוגדר, אחרת נגזר ב־HKDF-SHA256 מהמפתח
   הפרטי של חשבון השירות (סוד שחי רק ב־Vercel), עם salt/info ייעודיים — הפרדת מפתחות מכל שימוש אחר.
   פורמט: v1.<kid>.<iv>.<ciphertext+tag> (base64url). kid = e (מפתח ייעודי) / s (נגזר) — כך אפשר להחליף מפתח
   בלי לאבד רשומות ישנות. התוכן נדחס (deflate) לפני ההצפנה כדי להישאר הרחק ממגבלת המסמך. */
const crypto = require('crypto');
const zlib = require('zlib');
const { serviceAccount } = require('./gauth');

const b64u = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function keys() {
  const out = {};
  const env = String(process.env.IBKR_VAULT_KEY || '').trim();
  if (env) { const k = Buffer.from(env, 'base64'); if (k.length === 32) out.e = k; }
  const sa = serviceAccount();
  if (sa) out.s = Buffer.from(crypto.hkdfSync('sha256', Buffer.from(sa.private_key), Buffer.from('snb-ibkr-vault/salt/v1'), Buffer.from('snb-ibkr-vault aes-256-gcm v1'), 32));
  return out;
}
function configured() { const k = keys(); return !!(k.e || k.s); }

function seal(obj, aad) {
  const k = keys(); const kid = k.e ? 'e' : k.s ? 's' : '';
  if (!kid) throw new Error('vault_not_configured');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k[kid], iv);
  c.setAAD(Buffer.from('snb-ibkr-vault|v1|' + aad));
  const ct = Buffer.concat([c.update(zlib.deflateRawSync(Buffer.from(JSON.stringify(obj)))), c.final(), c.getAuthTag()]);
  return 'v1.' + kid + '.' + b64u(iv) + '.' + b64u(ct);
}
/* null = לא נפתח (מפתח אחר, AAD אחר, שובש) — לעולם לא זורק החוצה */
function open(str, aad) {
  try {
    const [v, kid, ivs, cts] = String(str || '').split('.');
    const key = keys()[kid];
    if (v !== 'v1' || !key) return null;
    const iv = unb64u(ivs), all = unb64u(cts);
    if (iv.length !== 12 || all.length < 17) return null;
    const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
    d.setAAD(Buffer.from('snb-ibkr-vault|v1|' + aad));
    d.setAuthTag(all.subarray(all.length - 16));
    const pt = Buffer.concat([d.update(all.subarray(0, all.length - 16)), d.final()]);
    return JSON.parse(zlib.inflateRawSync(pt).toString('utf8'));
  } catch (e) { return null; }
}

module.exports = { seal, open, configured };
