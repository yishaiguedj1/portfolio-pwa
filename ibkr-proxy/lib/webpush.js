'use strict';
/* התראות לטלפון — Web Push עצמאי (שלב 4 בסטודיו, 10/10/2026), בלי תלויות ובלי שירות חיצוני משלנו:
     RFC 8291 — הצפנת התוכן (aes128gcm): רק הטלפון יכול לקרוא; שירות ה־push (Google/Mozilla/Apple) רואה בייטים.
     RFC 8292 — VAPID: זוג מפתחות של השרתון, נוצר פעם אחת ונשמר מוצפן בכספת (lib/vault.js) — בלי הגדרה ידנית.
   מה נשלח: רק סוג האירוע (מוכן / שאלה / אישור / נעצרה) ומזהה העבודה — לא שם קובץ ולא תוכן (פרטיות, סעיף 3).
   SSRF: שולחים רק לשירותי ה־push המוכרים (PUSH_HOSTS), ב־https. */
const crypto = require('crypto');

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(String(s || ''), 'base64url');

const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/, /^web\.push\.apple\.com$/];
const SUB_MAX = 5;                 // מכשירים לאדם
const TTL = 24 * 3600;             // שעות שההתראה מחכה לטלפון כבוי
const SUBJECT = 'https://yishaiguedj1.github.io/portfolio-pwa/';   // VAPID "sub" — כתובת ולא מייל (פרטיות)
const KINDS = ['done', 'fail', 'ask', 'gate'];
const TEXT = {
  he: { done: ['התרגום מוכן ✓', 'הכתוביות והסרטון מחכים בסטודיו'], fail: ['העבודה נעצרה', 'פתחו את הסטודיו לפרטים'],
    ask: ['שאלה מ־Claude', 'העבודה מחכה לתשובה שלך'], gate: ['צריך את האישור שלך', 'העבודה מחכה לאישור'],
    test: ['ההתראות עובדות ✓', 'כך תדעו כשתרגום מוכן או כש־Claude שואל משהו'] },
  en: { done: ['Translation ready ✓', 'Subtitles and video are waiting in the studio'], fail: ['The job stopped', 'Open the studio for details'],
    ask: ['Claude has a question', 'The job is waiting for your answer'], gate: ['Your approval is needed', 'The job is waiting for approval'],
    test: ['Notifications work ✓', 'You will know when a translation is ready or Claude asks something'] },
};

function endpointOk(e) {
  let u;
  try { u = new URL(String(e || '')); } catch (x) { return false; }
  return u.protocol === 'https:' && !u.port && !u.username && String(e).length <= 1024 && PUSH_HOSTS.some((r) => r.test(u.hostname));
}

/* מה שהטלפון שולח (PushSubscription.toJSON) → {e, p, a, l}; לא תקין → null */
function normSub(o) {
  if (!o || typeof o !== 'object') return null;
  const e = String(o.endpoint || o.e || ''), k = o.keys || {};
  const p = String(k.p256dh || o.p || ''), a = String(k.auth || o.a || '');
  if (!endpointOk(e) || !/^[A-Za-z0-9_-]{87}$/.test(p) || !/^[A-Za-z0-9_-]{22}$/.test(a)) return null;
  if (unb64u(p).length !== 65 || unb64u(p)[0] !== 4 || unb64u(a).length !== 16) return null;
  return { e, p, a, l: (o.l || o.lang) === 'en' ? 'en' : 'he' };
}
function normSubs(list) {
  const out = [];
  for (const x of Array.isArray(list) ? list : []) {
    const s = normSub(x);
    if (s && !out.some((y) => y.e === s.e)) out.push(Object.assign(s, { at: Number(x.at) || 0 }));
  }
  return out.slice(-SUB_MAX);
}
function addSub(list, sub, now) { return normSubs(normSubs(list).filter((x) => x.e !== sub.e).concat([Object.assign({}, sub, { at: now })])); }
function dropSub(list, e) { return normSubs(list).filter((x) => x.e !== String(e || '')); }

/* ---------------------------------------------------------------- VAPID */
function genVapid() {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const j = privateKey.export({ format: 'jwk' });
  return { pub: b64u(Buffer.concat([Buffer.from([4]), unb64u(j.x), unb64u(j.y)])), d: j.d };
}
function privKey(v) {
  const p = unb64u(v.pub);
  return crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: v.d, x: b64u(p.subarray(1, 33)), y: b64u(p.subarray(33, 65)) }, format: 'jwk' });
}
function vapidAuth(v, endpoint, now) {
  const aud = new URL(endpoint).origin;
  const enc = (o) => b64u(Buffer.from(JSON.stringify(o)));
  const data = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: SUBJECT });
  const sig = crypto.sign('sha256', Buffer.from(data), { key: privKey(v), dsaEncoding: 'ieee-p1363' });
  return 'vapid t=' + data + '.' + b64u(sig) + ', k=' + v.pub;
}

/* ---------------------------------------------------------------- הצפנה (RFC 8291) */
function encrypt(sub, payload, opt = {}) {
  const ua = unb64u(sub.p), auth = unb64u(sub.a);
  if (ua.length !== 65 || auth.length !== 16) throw new Error('bad_sub');
  const ecdh = crypto.createECDH('prime256v1');
  if (opt.asPriv) ecdh.setPrivateKey(unb64u(opt.asPriv)); else ecdh.generateKeys();
  const asPub = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(ua);
  const salt = opt.salt ? unb64u(opt.salt) : crypto.randomBytes(16);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', secret, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);
}

/* התוכן של התראה: כותרת + שורה בשפת המכשיר, ולאן לפתוח. בלי שם קובץ ובלי תוכן העבודה */
function message(kind, jobId, lang) {
  const t = (TEXT[lang] || TEXT.he)[kind];
  if (!t) return null;
  const j = /^j[A-Za-z0-9_-]{20}$/.test(String(jobId || '')) ? jobId : '';
  return { t: t[0], b: t[1], k: kind, j, u: SUBJECT + (j ? '#studio=' + j : '') };
}

/* שליחה לכל המכשירים של אדם. מחזיר את הרשימה המעודכנת (מנוי שפג — 404/410 — יוצא ממנה) ומספר ההצלחות */
async function sendAll(deps, v, subs, kind, jobId, now) {
  const f = deps.fetch || fetch;
  const left = [];
  let sent = 0;
  for (const s of normSubs(subs)) {
    const msg = message(kind, jobId, s.l);
    if (!msg) { left.push(s); continue; }
    try {
      const r = await f(s.e, { method: 'POST', headers: { TTL: String(TTL), Urgency: kind === 'done' ? 'normal' : 'high',
        'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: vapidAuth(v, s.e, now) },
      body: encrypt(s, JSON.stringify(msg)), redirect: 'manual', signal: AbortSignal.timeout(5000) });
      if (r.status === 404 || r.status === 410) continue;      // המנוי בוטל בטלפון
      if (r.status >= 200 && r.status < 300) sent++;
      left.push(s);
    } catch (e) { left.push(s); }
  }
  return { subs: left, sent };
}

module.exports = { PUSH_HOSTS, SUB_MAX, KINDS, TEXT, endpointOk, normSub, normSubs, addSub, dropSub, genVapid, vapidAuth,
  encrypt, message, sendAll, b64u, unb64u };
