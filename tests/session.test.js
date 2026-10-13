/* החיבור המשותף (שלב 2 בתוכנית שלוש האפליקציות, 13/10/2026) — ibkr-proxy/lib/session.js.
   בלי רשת: חשבון שירות שנוצר כאן, Firestore מדומה, אסימון Firebase מדומה (verify מוזרק). */
'use strict';
const crypto = require('crypto');
const path = require('path');

let n = 0, bad = 0;
const ok = (c, m) => { n++; if (c) console.log('ok - ' + m); else { bad++; console.log('FAIL - ' + m); } };

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const SA = { type: 'service_account', client_email: 'sa@yishaiguedj1-c786e.iam.gserviceaccount.com', private_key: PEM };
process.env.GDRIVE_SA_KEY = JSON.stringify(SA);
process.env.FIREBASE_PROJECT_ID = 'yishaiguedj1-c786e';
delete process.env.SNB_SESSION_ENV;
delete process.env.SNB_SESSION_KEY;

const S = require(path.join(__dirname, '..', 'ibkr-proxy', 'lib', 'session.js'));
const unb64 = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/* ---------------------------------------------------------------- 1. מקור → אפליקציה */
const A = S.appForOrigin;
ok(A('https://thesnowball.app', 'prod') === 'all', 'הדומיין הראשי = האפליקציה המאוחדת (all)');
ok(A('https://invest.thesnowball.app', 'prod') === 'invest' && A('https://academy.thesnowball.app', 'prod') === 'academy'
  && A('https://studio.thesnowball.app', 'prod') === 'studio' && A('https://account.thesnowball.app', 'prod') === 'account', 'ארבע האפליקציות בייצור');
ok(A('https://books.thesnowball.app', 'prod') === '', 'Books שונה ל־Academy — books לא מוכר');
ok(A('https://staging.thesnowball.app', 'prod') === '' && A('https://invest-staging.thesnowball.app', 'prod') === '', 'הייצור לא מקבל את הניסוי (אותו אתר — העוגייה הייתה נשלחת)');
// שלב 4 (13/10/2026): בניסוי <אפליקציה>-staging — ברמה הראשונה (התעודה החינמית לא מכסה a.b.thesnowball.app)
ok(A('https://staging.thesnowball.app', 'staging') === 'all' && A('https://academy-staging.thesnowball.app', 'staging') === 'academy'
  && A('https://studio-staging.thesnowball.app', 'staging') === 'studio' && A('https://invest-staging.thesnowball.app', 'staging') === 'invest', 'הניסוי — שלו בלבד');
ok(A('https://academy.staging.thesnowball.app', 'staging') === '' && A('https://evil-staging.thesnowball.app', 'staging') === '', 'בניסוי — רק השמות הידועים, ברמה הראשונה');
ok(A('https://thesnowball.app', 'staging') === '' && A('https://invest.thesnowball.app', 'staging') === '', 'הניסוי לא מקבל את הייצור');
ok(['https://yishaiguedj1.github.io', 'http://thesnowball.app', 'https://evilthesnowball.app', 'https://invest.thesnowball.app.evil.com',
  'https://x.invest.thesnowball.app', 'https://thesnowball.pages.dev', '', 'null'].every((o) => A(o, 'prod') === '' && A(o, 'staging') === ''), 'כל מקור אחר נחסם');
ok(S.sessEnv({ FIREBASE_PROJECT_ID: 'yishaiguedj1-c786e' }) === 'prod' && S.sessEnv({ FIREBASE_PROJECT_ID: 'snowball-staging-758f6' }) === 'staging'
  && S.sessEnv({ FIREBASE_PROJECT_ID: 'snowball-staging-758f6', SNB_SESSION_ENV: 'prod' }) === 'prod', 'הסביבה לפי הפרויקט (או SNB_SESSION_ENV)');

/* ---------------------------------------------------------------- כלי הבדיקה */
let NOW = Date.UTC(2026, 9, 13, 12, 0, 0);
const sec = () => Math.floor(NOW / 1000);
const store = new Map();
let fsFail = 0, fsWrites = 0;
const fakeFetch = async (url, init = {}) => {
  const m = /documents\/sessions\/([^?]+)/.exec(url);
  if (!m) return { status: 404, json: async () => ({}) };
  if (fsFail) return { status: 500, json: async () => ({}) };
  if ((init.method || 'GET') === 'PATCH') {
    fsWrites++;
    store.set(m[1], JSON.parse(init.body).fields.vs.integerValue);
    return { status: 200, json: async () => ({}) };
  }
  if (!store.has(m[1])) return { status: 404, json: async () => ({}) };
  return { status: 200, json: async () => ({ fields: { vs: { integerValue: store.get(m[1]) } } }) };
};
const TOKENS = {
  fresh: () => ({ uid: 'u1', authTime: sec() - 30, provider: 'google.com' }),
  old: () => ({ uid: 'u1', authTime: sec() - 3600, provider: 'google.com' }),
  custom: () => ({ uid: 'u1', authTime: sec() - 10, provider: 'custom' }),
  other: () => ({ uid: 'u2', authTime: sec() - 5, provider: 'google.com' }),
};
const H = S.makeHandler({
  fetch: fakeFetch, now: () => NOW, token: async () => 'tk',
  verify: async (t) => { if (!TOKENS[t]) throw new Error('bad_token'); return TOKENS[t](); },
  env: process.env,
});
let ipN = 0;
async function call(method, origin, body, cookie, ip) {
  const headers = { origin };
  if (cookie) headers.cookie = 'a=b; ' + S.COOKIE + '=' + cookie + '; c=d';
  headers['x-forwarded-for'] = ip || ('10.0.0.' + (++ipN % 250));
  const res = { code: 0, h: {}, body: null,
    setHeader(k, v) { this.h[k.toLowerCase()] = v; }, getHeader(k) { return this.h[k.toLowerCase()]; },
    status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; }, end() { return this; } };
  await H({ method, headers, body }, res);
  return res;
}
const cookieOf = (r) => { const m = /^__Host-snb_s=([^;]*);/.exec(r.h['set-cookie'] || ''); return m ? m[1] : null; };

(async () => {
  const INV = 'https://invest.thesnowball.app', ACA = 'https://academy.thesnowball.app';

  /* ---------------------------------------------------------------- 2. CORS ושיטות */
  let r = await call('OPTIONS', INV);
  ok(r.code === 204 && r.h['access-control-allow-origin'] === INV && r.h['access-control-allow-credentials'] === 'true', 'preflight ממקור מאושר: המקור המדויק + credentials');
  r = await call('OPTIONS', 'https://yishaiguedj1.github.io');
  ok(r.code === 403 && !r.h['access-control-allow-origin'] && !r.h['access-control-allow-credentials'], 'מקור לא מאושר: 403 בלי כותרות CORS');
  r = await call('POST', 'https://staging.thesnowball.app', { op: 'logout', all: true });
  ok(r.code === 403 && !r.h['set-cookie'], 'הניסוי לא יכול לנתק בייצור (נחסם לפני כל פעולה)');
  r = await call('GET', INV);
  ok(r.code === 405, 'GET → 405');
  r = await call('POST', INV, { op: 'nope' });
  ok(r.code === 400 && r.body.error === 'bad_op', 'פעולה לא מוכרת → 400');
  r = await call('POST', INV, { op: 'login', idToken: 'x'.repeat(9000) });
  ok(r.code === 413, 'גוף גדול → 413');

  /* ---------------------------------------------------------------- 3. התחברות → עוגייה */
  r = await call('POST', 'https://thesnowball.app', { op: 'login', idToken: 'fresh' });
  const c1 = cookieOf(r);
  const sc = r.h['set-cookie'] || '';
  ok(r.code === 200 && c1 && /HttpOnly/.test(sc) && /Secure/.test(sc) && /SameSite=Strict/.test(sc) && /Path=\//.test(sc)
    && /Max-Age=1209600/.test(sc) && !/Domain=/i.test(sc), 'התחברות טרייה → עוגייה __Host- (HttpOnly, Secure, Strict, שבועיים, בלי Domain)');
  ok(Object.keys(JSON.parse(unb64(String(c1).split('.')[1]))).sort().join() === 'a,i,p,u,x', 'בעוגייה רק מזהה וזמנים — בלי מייל ובלי שם');
  r = await call('POST', INV, { op: 'login', idToken: 'old' });
  ok(r.code === 403 && r.body.error === 'not_fresh' && !r.h['set-cookie'], 'התחברות של לפני שעה → לא מנפיקים עוגייה');
  r = await call('POST', INV, { op: 'login', idToken: 'custom' });
  ok(r.code === 403 && !r.h['set-cookie'], 'אסימון מטוקן מותאם → לא מנפיקים עוגייה (רק מ־Google)');
  r = await call('POST', INV, { op: 'login', idToken: 'garbage' });
  ok(r.code === 401 && !r.h['set-cookie'], 'אסימון לא תקין → 401');

  /* ---------------------------------------------------------------- 4. "מי מחובר?" → טוקן מותאם */
  r = await call('POST', INV, { op: 'who' });
  ok(r.code === 200 && r.body.s === 0 && !r.body.ct, 'בלי עוגייה: s=0, בלי טוקן');
  r = await call('POST', ACA, { op: 'who' }, c1);
  ok(r.code === 200 && r.body.s === 1 && r.body.u === 'u1' && r.body.app === 'academy', 'עם עוגייה: טוקן ל־Academy (אותו חשבון)');
  const [h64, b64, s64] = String(r.body.ct).split('.');
  const pl = JSON.parse(unb64(b64));
  ok(JSON.parse(unb64(h64)).alg === 'RS256' && crypto.verify('RSA-SHA256', Buffer.from(h64 + '.' + b64), publicKey, unb64(s64)), 'הטוקן חתום בחשבון השירות');
  ok(pl.iss === SA.client_email && pl.sub === SA.client_email && pl.aud === S.AUD && pl.uid === 'u1' && pl.exp - pl.iat === 3600,
    'הטוקן במבנה של Firebase (iss/sub/aud, שעה)');
  ok(pl.claims && pl.claims.app === 'academy' && Object.keys(pl.claims).length === 1, 'טענת app = האפליקציה שביקשה, ורק היא');
  ok(!r.h['set-cookie'], 'עוגייה טרייה — לא מחדשים');
  r = await call('POST', INV, { op: 'who' }, c1);
  ok(JSON.parse(unb64(r.body.ct.split('.')[1])).claims.app === 'invest', 'אותה עוגייה, אפליקציה אחרת → טוקן עם app אחר');

  /* זיוף / פג תוקף / פרויקט אחר */
  const parts = c1.split('.');
  const forged = JSON.parse(unb64(parts[1])); forged.u = 'admin';
  const forgedCookie = 'v1.' + Buffer.from(JSON.stringify(forged)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_') + '.' + parts[2];
  r = await call('POST', INV, { op: 'who' }, forgedCookie);
  ok(r.body.s === 0 && /Max-Age=0/.test(r.h['set-cookie'] || ''), 'עוגייה מזויפת → s=0 והעוגייה נמחקת');
  const key = S.cookieKey(process.env);
  const otherProj = S.sealCookie({ u: 'u1', a: sec(), i: sec(), x: sec() + 1000, p: 'snowball-staging-758f6' }, key);
  r = await call('POST', INV, { op: 'who' }, otherProj);
  ok(r.body.s === 0, 'עוגייה של פרויקט אחר → s=0');
  const expired = S.sealCookie({ u: 'u1', a: sec() - 99999, i: sec() - 99999, x: sec() - 1, p: 'yishaiguedj1-c786e' }, key);
  r = await call('POST', INV, { op: 'who' }, expired);
  ok(r.body.s === 0, 'עוגייה שפגה → s=0');
  const keyStg = (() => { const p = process.env.FIREBASE_PROJECT_ID; process.env.FIREBASE_PROJECT_ID = 'snowball-staging-758f6'; const k = S.cookieKey(process.env); process.env.FIREBASE_PROJECT_ID = p; return k; })();
  ok(!keyStg.equals(key), 'מפתח העוגייה שונה בכל פרויקט (אותו חשבון שירות לא מספיק)');
  ok(S.cookieKey({ SNB_SESSION_KEY: Buffer.alloc(32, 7).toString('base64') }).equals(Buffer.alloc(32, 7)), 'SNB_SESSION_KEY גובר כשהוגדר');

  /* ---------------------------------------------------------------- 5. חידוש בשימוש */
  NOW += 2 * 24 * 3600e3;
  r = await call('POST', INV, { op: 'who' }, c1);
  const c2 = cookieOf(r);
  ok(r.body.s === 1 && c2 && c2 !== c1, 'אחרי יומיים בשימוש — העוגייה מתחדשת לשבועיים');
  NOW += 13 * 24 * 3600e3;
  r = await call('POST', INV, { op: 'who' }, c1);
  ok(r.body.s === 0, 'העוגייה הישנה פגה אחרי שבועיים');
  r = await call('POST', INV, { op: 'who' }, c2);
  ok(r.body.s === 1, 'המחודשת עדיין תקפה');

  /* ---------------------------------------------------------------- 6. התנתקות */
  r = await call('POST', INV, { op: 'logout' }, c2);
  ok(r.code === 200 && /Max-Age=0/.test(r.h['set-cookie'] || '') && r.body.all === false && fsWrites === 0, 'התנתקות מהמכשיר: מוחקת עוגייה, בלי כתיבה');
  r = await call('POST', INV, { op: 'login', idToken: 'fresh' });
  const c3 = cookieOf(r);
  NOW += 5e3;
  r = await call('POST', ACA, { op: 'login', idToken: 'fresh' });
  const c4 = cookieOf(r);                       // מכשיר שני
  r = await call('POST', INV, { op: 'logout', all: true }, c3);
  ok(r.body.all === true && fsWrites === 1, 'התנתקות מכל המכשירים — נרשם סימן זמן');
  r = await call('POST', ACA, { op: 'who' }, c4);
  ok(r.body.s === 0, 'המכשיר השני: העוגייה שלו כבר לא תקפה');
  NOW += 5e3;
  r = await call('POST', INV, { op: 'login', idToken: 'fresh' });
  r = await call('POST', INV, { op: 'who' }, cookieOf(r));
  ok(r.body.s === 1, 'התחברות חדשה אחרי ההתנתקות — עובדת');
  r = await call('POST', INV, { op: 'logout', all: true });
  ok(r.body.all === false && fsWrites === 1, 'בלי עוגייה אי אפשר לנתק אחרים');

  /* ---------------------------------------------------------------- 7. אחסון שנפל = לא מנפיקים (וגם לא "מתנתקים") */
  S._reset();
  r = await call('POST', INV, { op: 'login', idToken: 'other' });
  const c5 = cookieOf(r);
  fsFail = 1;
  r = await call('POST', INV, { op: 'who' }, c5);
  ok(r.code === 503 && r.body.error === 'store' && !r.body.ct && r.body.s === undefined, 'Firestore נפל → 503 (לא טוקן, וגם לא s=0 שינתק את הטלפון)');
  fsFail = 0;

  /* ---------------------------------------------------------------- 8. קצב */
  let last;
  for (let i = 0; i < 61; i++) last = await call('POST', INV, { op: 'who' }, null, '9.9.9.9');
  ok(last.code === 429, 'יותר מ־60 בקשות בדקה מאותה כתובת → 429');

  /* ---------------------------------------------------------------- 9. שרת הניסוי */
  const Hs = S.makeHandler({ fetch: fakeFetch, now: () => NOW, token: async () => 'tk', verify: async () => TOKENS.fresh(),
    env: { FIREBASE_PROJECT_ID: 'snowball-staging-758f6' } });
  const res = { code: 0, h: {}, setHeader(k, v) { this.h[k.toLowerCase()] = v; }, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; }, end() { return this; } };
  await Hs({ method: 'POST', headers: { origin: INV }, body: { op: 'who' } }, res);
  ok(res.code === 403, 'שרת הניסוי חוסם את מקור הייצור');

  console.log('# ' + n + ' בדיקות, ' + bad + ' נכשלו');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
