'use strict';
/* 6/11/2026 — שלב 2 בתוכנית העצמאות מ־Firebase: החשבונות אצלנו (גל 1, צד השרת בלבד, מאחורי הדגל acc_srv).

   מה נשמר: snbAcc/{uid} — רשומה אחת לחשבון, **מוצפנת כולה** (vault.seal, AES-256-GCM, AAD = snb-acc|uid):
     { v:1, uid, em:[מיילים מאומתים], g:[מזהי Google (sub)], pw:{s,h,N,r,p}|null, ct, lt }
   ואינדקסים לחיפוש — snbAccIx/{id}, id = HMAC של "g|<sub>" / "e|<מייל>" במפתח שנגזר מהכספת (snb-acc-ix/v1).
   כך אין במסד (ולא בעותק ב־Firestore, ולא בתמונת המצב ב־R2) אף מייל או מזהה Google גלוי, ואי אפשר לבדוק "האם המייל
   הזה רשום" בלי המפתח. גם האינדקס מוצפן (AAD = snb-accix|id), כך שהעתקה של אינדקס לחשבון אחר לא נפתחת.

   הגישה — דרך Firestore REST (deps.fetch): בשרת שלנו האוספים האלה נענים מהמסד (lib/ldbsync.js — לא אוסף של הטלפון),
   והעותק ב־Firestore מתעדכן ברקע. בכללים של Firestore אין להם הרשאה לטלפון (ברירת המחדל — חסום).

   מזהה: **אותו uid של Firebase.** חשבון שלא מוכר אצלנו נבדק קודם מול Firebase (lib/fbadmin.js lookup) — כך משתמש ותיק
   לא מקבל חשבון כפול. רק כש־Firebase עונה "אין כזה" נוצר uid חדש (28 תווים, כמו של Firebase). Firebase לא עונה — נכשלים
   סגור (לא יוצרים חשבון).

   סיסמאות: scrypt (מובנה ב־Node), N=2^15, r=8, p=1, מלח 16 בתים, השוואה בזמן קבוע. אין סיסמאות של Firebase אצלנו (אי אפשר
   לייצא אותן בלי כלי מנהל) — הן נכנסות בהדרגה: אחרי כניסה מוצלחת עם סיסמה ב־Firebase, הטלפון שולח אותה פעם אחת (pwSet). */
const crypto = require('crypto');

const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';
const BASE = () => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents/';
const COL = 'snbAcc', IX = 'snbAccIx';
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const GSUB_RE = /^\d{5,40}$/;
const EMAIL_RE = /^[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/;
const MAX_EM = 10, MAX_G = 5;
const PW_MIN = 6, PW_MAX = 256;   // 6 — המינימום של Firebase (סיסמאות קיימות נכנסות כמו שהן)
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const B62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const normEmail = (s) => { const e = String(s == null ? '' : s).trim().toLowerCase(); return EMAIL_RE.test(e) ? e : ''; };
function newUid() {
  let s = '';
  while (s.length < 28) { const b = crypto.randomBytes(32); for (const x of b) if (x < 248 && s.length < 28) s += B62[x % 62]; }
  return s;
}
function scryptP(pw, salt, o) {
  return new Promise((res, rej) => crypto.scrypt(String(pw).normalize('NFC'), salt, 32, o, (e, k) => (e ? rej(e) : res(k))));
}
async function hashPw(pw) {
  const salt = crypto.randomBytes(16);
  const h = await scryptP(pw, salt, SCRYPT);
  return { s: salt.toString('base64'), h: h.toString('base64'), N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p };
}
async function checkPw(rec, pw) {
  const ok = rec && rec.s && rec.h && +rec.N >= 1024 && +rec.N <= (1 << 20);
  const salt = ok ? Buffer.from(rec.s, 'base64') : crypto.randomBytes(16);
  const want = ok ? Buffer.from(rec.h, 'base64') : crypto.randomBytes(32);
  const got = await scryptP(pw, salt, ok ? { N: +rec.N, r: +rec.r || 8, p: +rec.p || 1, maxmem: SCRYPT.maxmem } : SCRYPT);   // גם בלי רשומה — אותו זמן
  return !!ok && want.length === got.length && crypto.timingSafeEqual(want, got);
}
const pwValid = (pw) => typeof pw === 'string' && pw.length >= PW_MIN && pw.length <= PW_MAX;

/* deps: { fetch, token: async()=>string, now, seal(obj,aad), open(str,aad), ixKey: Buffer, fb: { byEmail, byGoogle } } */
function make(deps) {
  const now = deps.now || Date.now;
  const ixId = (kind, val) => crypto.createHmac('sha256', deps.ixKey).update('snb-acc|' + kind + '|' + val).digest('hex').slice(0, 40);
  async function req(method, path, body) {
    const tk = await deps.token();
    const r = await deps.fetch(BASE() + path, { method, headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 404 && method === 'GET') return null;
    if (r.status !== 200) throw new Error('fs_http_' + r.status);
    return r.json();
  }
  const sealed = (o, aad) => ({ fields: { r: { stringValue: deps.seal(o, aad) }, at: { integerValue: String(Math.round(now())) } } });
  async function get(uid) {
    if (!UID_RE.test(String(uid || ''))) return null;
    const j = await req('GET', COL + '/' + uid);
    if (!j) return null;
    const o = deps.open(((j.fields || {}).r || {}).stringValue || '', 'snb-acc|' + uid);
    return o && o.uid === uid ? o : null;   // לא נפתח / לא שלו — כאילו אין (לא סומכים על המבנה)
  }
  const put = (rec) => req('PATCH', COL + '/' + rec.uid, sealed(rec, 'snb-acc|' + rec.uid));
  async function ixGet(kind, val) {
    const id = ixId(kind, val);
    const j = await req('GET', IX + '/' + id);
    if (!j) return '';
    const o = deps.open(((j.fields || {}).r || {}).stringValue || '', 'snb-accix|' + id);
    return o && UID_RE.test(String(o.u || '')) ? o.u : '';
  }
  const ixPut = (kind, val, uid) => { const id = ixId(kind, val); return req('PATCH', IX + '/' + id, sealed({ u: uid }, 'snb-accix|' + id)); };

  /* מוסיף מיילים/מזהי Google לרשומה (בלי כפילויות, עם תקרה), וכותב אינדקס רק למה שחדש. מחזיר את הרשומה */
  async function absorb(uid, add) {
    let rec = await get(uid);
    const fresh = !rec;
    if (!rec) rec = { v: 1, uid, em: [], g: [], pw: null, ct: Math.round(now()), lt: 0 };
    const newEm = (add.em || []).map(normEmail).filter((e) => e && !rec.em.includes(e));
    const newG = (add.g || []).map(String).filter((g) => GSUB_RE.test(g) && !rec.g.includes(g));
    const touch = add.login && now() - (+rec.lt || 0) > 3600e3;
    if (!fresh && !newEm.length && !newG.length && !touch) return rec;
    rec.em = rec.em.concat(newEm).slice(0, MAX_EM);
    rec.g = rec.g.concat(newG).slice(0, MAX_G);
    if (add.login) rec.lt = Math.round(now());
    await put(rec);
    for (const e of newEm) if (rec.em.includes(e)) await ixPut('e', e, uid);
    for (const g of newG) if (rec.g.includes(g)) await ixPut('g', g, uid);
    return rec;
  }

  /* הרישום השקט: כל מי שנכנס דרך Firebase (טוקן מאומת שלא מותאם). רק מיילים מאומתים ומזהי Google מהטוקן עצמו.
     מטמון בזיכרון — לא כותבים שוב אותו דבר */
  const seen = new Map();
  async function observe(u) {
    if (!u || !UID_RE.test(String(u.uid || '')) || u.provider === 'custom') return null;
    const em = (u.emails || []).map(normEmail).filter(Boolean);
    const g = (u.gsubs || []).map(String).filter((x) => GSUB_RE.test(x));
    const sig = em.join(',') + '|' + g.join(',');
    const c = seen.get(u.uid);
    if (c && c.sig === sig && now() - c.at < 6 * 3600e3) return null;
    const rec = await absorb(u.uid, { em, g });
    if (seen.size > 5000) seen.clear();
    seen.set(u.uid, { sig, at: now() });
    return rec;
  }

  /* מזהה לפי מייל או Google: אצלנו → Firebase → חדש (create). מחזיר { uid, made } או זורק */
  async function resolve(kind, val, email, create) {
    let uid = await ixGet(kind, val);
    if (!uid && kind === 'g' && email) uid = await ixGet('e', email);   // אותו מייל מאומת — אותו חשבון (כמו ב־Firebase)
    if (uid) return { uid, made: false };
    const f = kind === 'g' ? await deps.fb.byGoogle(val, email) : await deps.fb.byEmail(val);   // זורק כש־Firebase לא עונה
    if (f && UID_RE.test(String(f.uid || ''))) {
      await absorb(f.uid, { em: (f.emails || []).concat(email ? [email] : []), g: f.gsubs || [] });
      return { uid: f.uid, made: false };
    }
    if (!create) return { uid: '', made: false };
    return { uid: newUid(), made: true };
  }
  async function loginGoogle(g) {
    if (!GSUB_RE.test(String(g.sub || ''))) throw new Error('bad_token');
    const email = g.verified ? normEmail(g.email) : '';
    if (!email) throw new Error('unverified');   // חשבון Google בלי מייל מאומת — לא מקשרים ולא יוצרים
    const r = await resolve('g', String(g.sub), email, true);
    await absorb(r.uid, { em: [email], g: [String(g.sub)], login: true });
    return r;
  }
  async function loginEmail(email) {
    const e = normEmail(email);
    if (!e) throw new Error('bad_email');
    const r = await resolve('e', e, e, true);
    await absorb(r.uid, { em: [e], login: true });
    return r;
  }
  /* סיסמה: כניסה (מייל + סיסמה) — אותה תשובה כשאין חשבון / אין סיסמה / סיסמה שגויה */
  async function loginPw(email, pw) {
    const e = normEmail(email);
    if (!e || !pwValid(pw)) { await checkPw(null, 'x'.repeat(8)); return ''; }
    const uid = await ixGet('e', e);
    const rec = uid ? await get(uid) : null;
    const ok = await checkPw(rec && rec.em.includes(e) ? rec.pw : null, pw);
    if (!ok) return '';
    await absorb(uid, { login: true });
    return uid;
  }
  async function setPw(uid, email, pw) {
    if (!pwValid(pw)) throw new Error('bad_password');
    const e = normEmail(email);
    const rec = (await absorb(uid, { em: e ? [e] : [] }));
    rec.pw = await hashPw(pw);
    await put(rec);
    return true;
  }
  return { get, observe, loginGoogle, loginEmail, loginPw, setPw, ixId, _seen: seen };
}

/* ---------- אימות אסימון של Google (מהחלפת קוד בשרת — אבל בודקים חתימה בכל זאת: רף אבטחה, לא אמון ברשת) ---------- */
const G_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
let gk = { at: 0, ttl: 0, keys: null };
const unb64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
async function googleKeys(fetchImpl) {
  const t = Date.now();
  if (gk.keys && t - gk.at < gk.ttl) return gk.keys;
  const r = await (fetchImpl || fetch)(G_CERTS);
  if (r.status !== 200) throw new Error('certs_http_' + r.status);
  const m = String((r.headers && r.headers.get && r.headers.get('cache-control')) || '').match(/max-age=(\d+)/);
  const j = await r.json(), keys = {};
  for (const k of (j && j.keys) || []) if (k && k.kid && k.kty === 'RSA') { try { keys[k.kid] = crypto.createPublicKey({ key: k, format: 'jwk' }); } catch (e) {} }
  gk = { at: t, ttl: Math.min(6 * 3600, m ? +m[1] : 3600) * 1000, keys };
  return keys;
}
/* { sub, email, verified, name } או זורק bad_token / expired / wrong_aud / nonce */
async function verifyGoogle(idt, o) {
  const parts = String(idt || '').split('.');
  if (parts.length !== 3 || idt.length > 4000) throw new Error('bad_token');
  let head, c;
  try { head = JSON.parse(unb64url(parts[0])); c = JSON.parse(unb64url(parts[1])); } catch (e) { throw new Error('bad_token'); }
  if (head.alg !== 'RS256' || !head.kid) throw new Error('bad_token');
  const keys = o.keys || await googleKeys(o.fetch);
  const key = keys[head.kid];
  if (!key || !crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), key, unb64url(parts[2]))) throw new Error('bad_token');
  const nowS = Math.floor((o.now || Date.now()) / 1000);
  if (c.iss !== 'https://accounts.google.com' && c.iss !== 'accounts.google.com') throw new Error('bad_token');
  if (!o.aud || c.aud !== o.aud) throw new Error('wrong_aud');
  if (!(c.exp > nowS) || c.iat > nowS + 300) throw new Error('expired');
  if (o.nonce && c.nonce !== o.nonce) throw new Error('nonce');
  return { sub: String(c.sub || ''), email: String(c.email || '').toLowerCase(), verified: c.email_verified === true || c.email_verified === 'true', name: String(c.name || '').slice(0, 80) };
}

module.exports = { make, verifyGoogle, hashPw, checkPw, pwValid, newUid, normEmail, COL, IX, SCRYPT, PW_MIN, PW_MAX, _reset: () => { gk = { at: 0, ttl: 0, keys: null }; } };
