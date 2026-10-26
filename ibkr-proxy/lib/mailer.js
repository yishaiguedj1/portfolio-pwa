'use strict';
/* שליחת מיילים משלנו — חינמית לחלוטין (26/10/2026, בקשת המשתמש; `תוכנית-עמידות-שירותים.md`, שלב 2).
   ב־Firebase בחינם: קישור כניסה במייל — 5 ביום לכל המערכת, איפוס סיסמה — 150. כאן: כמה שירותי שליחה, כל אחד במכסה החינמית
   שלו, כולם מ־noreply@thesnowball.app — הראשון שיש לו מקום שולח, נכשל → הבא. השליחה נעצרת לפני המכסה (MARGIN), כך שאין חיוב
   אף פעם (ובתוכניות החינמיות האלה ממילא אין חיוב — השליחה נעצרת). כולם נכשלו → הטלפון חוזר לשליחה של Firebase (גיבוי).

   המפתחות: בכספת (studioVault/_mail, ‏AAD 'mail|keys') — המנהל מדביק אותם במרכז הניהול (adminMail), בלי הקמה מחדש של השרת;
   או במשתני סביבה (BREVO_API_KEY …). לא חוזרים לשום מסך. המונים: sysMail/c — יום וחודש לכל שירות (מטמון 60 שנ׳ בזיכרון). */
const vault = require('./vault');

const PROVIDERS = [
  { k: 'brevo', day: 300, month: 9000, env: 'BREVO_API_KEY' },
  { k: 'mailjet', day: 200, month: 6000, env: 'MAILJET_API_KEY' },          // "key:secret"
  { k: 'resend', day: 100, month: 3000, env: 'RESEND_API_KEY' },
  { k: 'smtp2go', day: 200, month: 1000, env: 'SMTP2GO_API_KEY' },
];
const KEYS = PROVIDERS.map((p) => p.k);
const MARGIN = 0.9;                       // עוצרים ב־90% מהמכסה
const COOL_MS = 60 * 60e3;                // שירות שסירב (מכסה/חסימה) — שעה בצד
const KEY_DOC = '_mail', KEY_AAD = 'mail|keys';
const FROM = () => process.env.MAIL_FROM || 'noreply@thesnowball.app';
const FROM_NAME = 'THE SNOWBALL';
const EMAIL_RE = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[a-z]{2,24}$/i;
const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';
const BASE = () => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents';

const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const monthOf = (ms) => new Date(ms).toISOString().slice(0, 7);

/* ---------------------------------------------------------------- המונים (טהור) */
/* c = המסמך כמו שנקרא (שטוח): d, m, <k>D, <k>M, <k>E, <k>T. מחזיר את המונה של היום/החודש (מתאפס כשהתחלף) */
function countsOf(c, now) {
  const d = dayOf(now), m = monthOf(now), out = {};
  for (const k of KEYS) {
    out[k] = { day: c && c.d === d ? +c[k + 'D'] || 0 : 0, month: c && c.m === m ? +c[k + 'M'] || 0 : 0,
      err: (c && c[k + 'E']) || '', errAt: +(c && c[k + 'T']) || 0 };
  }
  return out;
}
/* סדר הניסיון: רק שירות עם מפתח, מתחת ל־90% ביום ובחודש, ולא בצד אחרי סירוב בשעה האחרונה */
function plan(keys, counts, now) {
  return PROVIDERS.filter((p) => keys[p.k]).filter((p) => {
    const c = counts[p.k];
    if (c.day >= Math.floor(p.day * MARGIN) || c.month >= Math.floor(p.month * MARGIN)) return false;
    return !(c.err && /^(quota|denied)$/.test(c.err) && now - c.errAt < COOL_MS);
  }).map((p) => p.k);
}
function bump(c, k, now, err) {
  const d = dayOf(now), m = monthOf(now);
  const o = Object.assign({}, c || {});
  if (o.d !== d) { for (const x of KEYS) o[x + 'D'] = 0; o.d = d; }
  if (o.m !== m) { for (const x of KEYS) o[x + 'M'] = 0; o.m = m; }
  if (err) { o[k + 'E'] = err; o[k + 'T'] = now; return o; }
  o[k + 'D'] = (+o[k + 'D'] || 0) + 1; o[k + 'M'] = (+o[k + 'M'] || 0) + 1;
  if (o[k + 'E']) { o[k + 'E'] = ''; o[k + 'T'] = 0; }
  return o;
}

/* ---------------------------------------------------------------- הבקשה לכל שירות (טהור — נבדק בלי רשת) */
function request(k, key, m) {
  const from = FROM(), name = FROM_NAME;
  if (k === 'brevo') return { url: 'https://api.brevo.com/v3/smtp/email', headers: { 'api-key': key, accept: 'application/json' },
    body: { sender: { name, email: from }, to: [{ email: m.to }], subject: m.subject, htmlContent: m.html, textContent: m.text } };
  if (k === 'mailjet') return { url: 'https://api.mailjet.com/v3.1/send', headers: { Authorization: 'Basic ' + Buffer.from(key).toString('base64') },
    body: { Messages: [{ From: { Email: from, Name: name }, To: [{ Email: m.to }], Subject: m.subject, TextPart: m.text, HTMLPart: m.html }] } };
  if (k === 'resend') return { url: 'https://api.resend.com/emails', headers: { Authorization: 'Bearer ' + key },
    body: { from: name + ' <' + from + '>', to: [m.to], subject: m.subject, html: m.html, text: m.text } };
  if (k === 'smtp2go') return { url: 'https://api.smtp2go.com/v3/email/send', headers: { 'X-Smtp2go-Api-Key': key },
    body: { sender: name + ' <' + from + '>', to: [m.to], subject: m.subject, html_body: m.html, text_body: m.text } };
  return null;
}
/* קוד השגיאה מהתשובה (טהור): quota / denied (מפתח/דומיין) / bad / net */
function errCode(status) {
  if (status === 429 || status === 402) return 'quota';
  if (status === 401 || status === 403) return 'denied';
  if (status >= 400 && status < 500) return 'bad';
  return 'net';
}

/* ---------------------------------------------------------------- Firestore + הכספת */
async function fs(deps, method, path, body) {
  const tk = await deps.token();
  const r = await deps.fetch(BASE() + path, { method, headers: Object.assign({ Authorization: 'Bearer ' + tk }, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined });
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
  return r.json();
}
const flat = (doc) => { const o = {}; for (const [k, v] of Object.entries((doc && doc.fields) || {})) o[k] = 'integerValue' in v ? +v.integerValue : v.stringValue != null ? v.stringValue : null; return o; };
const fields = (o) => { const f = {}; for (const [k, v] of Object.entries(o)) f[k] = typeof v === 'number' ? { integerValue: String(Math.round(v)) } : { stringValue: String(v == null ? '' : v) }; return f; };

let memC = { at: 0, v: null }, memK = { at: 0, v: null };
const MEM_MS = 60e3;
async function readCounts(deps, now) {
  if (memC.v && now - memC.at < MEM_MS) return memC.v;
  memC = { at: now, v: flat(await fs(deps, 'GET', '/sysMail/c')) };
  return memC.v;
}
async function writeCounts(deps, o, now) {
  memC = { at: now, v: o };
  const f = fields(o);
  await fs(deps, 'PATCH', '/sysMail/c?' + Object.keys(f).map((k) => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&'), { fields: f }).catch(() => null);
}
/* המפתחות: הכספת גוברת, אחר כך משתני הסביבה */
async function readKeys(deps, now, fresh) {
  if (!fresh && memK.v && now - memK.at < MEM_MS) return memK.v;
  const out = {};
  for (const p of PROVIDERS) if (process.env[p.env]) out[p.k] = p.k === 'mailjet' && process.env.MAILJET_SECRET_KEY ? process.env[p.env] + ':' + process.env.MAILJET_SECRET_KEY : process.env[p.env];
  try {
    const d = flat(await fs(deps, 'GET', '/studioVault/' + KEY_DOC));
    const o = d.mk && vault.configured() ? vault.open(d.mk, KEY_AAD) : null;
    if (o) for (const k of KEYS) if (typeof o[k] === 'string' && o[k]) out[k] = o[k];
  } catch (e) {}
  memK = { at: now, v: out };
  return out;
}
async function saveKey(deps, k, key, now) {
  if (!KEYS.includes(k)) throw new Error('bad_params');
  const d = flat(await fs(deps, 'GET', '/studioVault/' + KEY_DOC));
  const cur = (d.mk && vault.open(d.mk, KEY_AAD)) || {};
  if (key) cur[k] = String(key).trim(); else delete cur[k];
  await fs(deps, 'PATCH', '/studioVault/' + KEY_DOC + '?updateMask.fieldPaths=mk&updateMask.fieldPaths=mv', { fields: fields({ mk: vault.seal(cur, KEY_AAD), mv: now }) });
  memK = { at: 0, v: null };
}
const normKey = (k, key) => {
  const s = String(key || '').trim();
  if (!s || s.length > 300 || /[\s<>"']/.test(s)) return '';
  if (k === 'mailjet' && !/^[^:]+:[^:]+$/.test(s)) return '';
  return s;
};

/* ---------------------------------------------------------------- השליחה */
/* m = { to, subject, html, text }. מחזיר { ok, via } או { ok:false, error: 'no_provider' | 'all_failed', tried } */
async function send(deps, m, nowMs) {
  const now = nowMs || Date.now();
  if (!m || !EMAIL_RE.test(String(m.to || ''))) return { ok: false, error: 'bad_email' };
  const keys = await readKeys(deps, now);
  let c = await readCounts(deps, now).catch(() => ({}));
  const order = plan(keys, countsOf(c, now), now);
  if (!order.length) return { ok: false, error: 'no_provider' };
  const tried = [];
  for (const k of order) {
    const rq = request(k, keys[k], m);
    let st = 0;
    try {
      const r = await deps.fetch(rq.url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, rq.headers), body: JSON.stringify(rq.body) });
      st = r.status;
      if (st >= 200 && st < 300 && k === 'smtp2go') { const j = await r.json().catch(() => ({})); if (!(j && j.data && j.data.succeeded >= 1)) st = 500; }
    } catch (e) { st = 0; }
    if (st >= 200 && st < 300) {
      c = bump(c, k, now);
      await writeCounts(deps, c, now);
      return { ok: true, via: k, tried };
    }
    const err = errCode(st);
    tried.push(k + ':' + err);
    c = bump(c, k, now, err);
  }
  await writeCounts(deps, c, now);
  return { ok: false, error: 'all_failed', tried };
}

/* מצב לממשק הניהול (בלי מפתחות): לכל שירות — מוגדר?, היום/מכסה, החודש/מכסה, שגיאה אחרונה */
async function view(deps, nowMs) {
  const now = nowMs || Date.now();
  const keys = await readKeys(deps, now, true);
  const counts = countsOf(await readCounts(deps, now).catch(() => ({})), now);
  const order = plan(keys, counts, now);
  return { from: FROM(), list: PROVIDERS.map((p) => ({ k: p.k, on: !!keys[p.k], day: counts[p.k].day, dayMax: p.day, month: counts[p.k].month, monthMax: p.month,
    err: counts[p.k].err, errAt: counts[p.k].errAt, next: order[0] === p.k })), left: order.reduce((n, k) => { const p = PROVIDERS.find((x) => x.k === k); return n + Math.max(0, Math.floor(p.day * MARGIN) - counts[k].day); }, 0) };
}

/* ---------------------------------------------------------------- תבניות (טהור) — עברית / אנגלית */
const escH = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const T = {
  he: {
    in: { s: 'קוד הכניסה שלך: {code}', h: 'כניסה ל־THE SNOWBALL', p: 'זה קוד הכניסה שלך. הוא תקף ל־10 דקות.', b: 'או כניסה בלחיצה', x: 'לא ביקשת להיכנס? אפשר להתעלם מהמייל.' },
    reset: { s: 'איפוס הסיסמה ב־THE SNOWBALL', h: 'איפוס סיסמה', p: 'ביקשת לאפס את הסיסמה. הקישור תקף לשעה.', b: 'בחירת סיסמה חדשה', x: 'לא ביקשת? אפשר להתעלם — הסיסמה לא משתנה.' },
    verify: { s: 'אימות המייל ב־THE SNOWBALL', h: 'אימות המייל', p: 'נגיעה אחת כדי לאמת את המייל — אחר כך ההרשאות שלך נפתחות.', b: 'אימות המייל', x: 'לא נרשמת? אפשר להתעלם מהמייל.' },
    test: { s: 'בדיקת שליחה מ־THE SNOWBALL', h: 'השליחה עובדת', p: 'המייל הזה נשלח ממרכז הניהול, דרך שרשרת שירותי השליחה.', b: '', x: 'אם הוא הגיע לספאם — לבדוק את רשומות ה־DNS (SPF ו־DKIM) של השירות.' },
  },
  en: {
    in: { s: 'Your sign-in code: {code}', h: 'Sign in to THE SNOWBALL', p: 'This is your sign-in code. It is valid for 10 minutes.', b: 'Or sign in with one tap', x: "Didn't try to sign in? You can ignore this email." },
    reset: { s: 'Reset your THE SNOWBALL password', h: 'Password reset', p: 'You asked to reset your password. The link is valid for an hour.', b: 'Choose a new password', x: "Didn't ask? Ignore this — your password stays the same." },
    verify: { s: 'Verify your email for THE SNOWBALL', h: 'Verify your email', p: 'One tap to verify your email — then your permissions open up.', b: 'Verify email', x: "Didn't sign up? You can ignore this email." },
    test: { s: 'THE SNOWBALL sending test', h: 'Sending works', p: 'This email was sent from the admin center, through the sending chain.', b: '', x: 'If it landed in spam — check the DNS records (SPF and DKIM) of the provider.' },
  },
};
function render(kind, lang, o) {
  const L = T[lang === 'en' ? 'en' : 'he'], dir = lang === 'en' ? 'ltr' : 'rtl';
  const t = L[kind] || L.in;
  const code = String(o.code || '').replace(/\D/g, '').slice(0, 8), link = /^https:\/\//.test(String(o.link || '')) ? String(o.link) : '';
  const subject = t.s.replace('{code}', code);
  const html = '<!doctype html><html dir="' + dir + '"><body style="margin:0;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="max-width:440px;margin:24px auto;background:#fff;border-radius:16px;padding:28px 24px;text-align:center;color:#191c1a">' +
    '<div style="font-weight:700;letter-spacing:.5px;color:#1e9e45">THE SNOWBALL</div>' +
    '<h1 style="font-size:22px;margin:14px 0 6px">' + escH(t.h) + '</h1><p style="color:#5f6368;font-size:15px;line-height:1.6;margin:0 0 18px">' + escH(t.p) + '</p>' +
    (code ? '<div style="font-size:34px;font-weight:700;letter-spacing:8px;direction:ltr;margin:6px 0 18px">' + escH(code) + '</div>' : '') +
    (link ? '<a href="' + escH(link) + '" style="display:inline-block;background:#30d158;color:#08300f;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">' + escH(t.b) + '</a>' : '') +
    '<p style="color:#9aa0a6;font-size:12.5px;margin:22px 0 0">' + escH(t.x) + '</p></div></body></html>';
  const text = t.h + '\n\n' + t.p + (code ? '\n\n' + code : '') + (link ? '\n\n' + t.b + ': ' + link : '') + '\n\n' + t.x;
  return { subject, html, text };
}

module.exports = { PROVIDERS, KEYS, MARGIN, EMAIL_RE, countsOf, plan, bump, request, errCode, send, view, render, saveKey, normKey, readKeys,
  _reset: () => { memC = { at: 0, v: null }; memK = { at: 0, v: null }; } };
