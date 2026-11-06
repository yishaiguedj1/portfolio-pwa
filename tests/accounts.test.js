/* שלב 2 בתוכנית העצמאות מ־Firebase (6/11/2026) — החשבונות אצלנו: ibkr-proxy/lib/accounts.js + הפעולות ב־lib/session.js.
   בלי רשת: חשבון שירות שנוצר כאן, Firestore מדומה, Google מדומה (מפתח RSA מקומי), Firebase lookup מדומה.
   בדיקות האבטחה (docs/privacy.md, "מערכות משלנו"): הצפנה במנוחה, AAD, חתימה מזויפת, aud/nonce, נעילה, נכשל סגור, כבוי = off. */
'use strict';
const crypto = require('crypto');
const path = require('path');

let n = 0, bad = 0;
const ok = (c, m) => { n++; if (c) console.log('ok - ' + m); else { bad++; console.log('FAIL - ' + m); } };

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = { type: 'service_account', client_email: 'sa@yishaiguedj1-c786e.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
process.env.GDRIVE_SA_KEY = JSON.stringify(SA);
process.env.FIREBASE_PROJECT_ID = 'yishaiguedj1-c786e';
delete process.env.IBKR_VAULT_KEY; delete process.env.SNB_ACC; delete process.env.SNB_SESSION_ENV;
process.env.GDRIVE_CLIENT_ID = 'cid.apps.googleusercontent.com'; process.env.GDRIVE_CLIENT_SECRET = 'csecret';

const L = (f) => require(path.join(__dirname, '..', 'ibkr-proxy', 'lib', f));
const A = L('accounts.js'), V = L('vault.js'), S = L('session.js'), SF = L('sysflags.js');
const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/* Firestore מדומה — רק snbAcc / snbAccIx */
const db = new Map();
let writes = 0, fsDown = false;
const fsFetch = async (url, init = {}) => {
  const m = /documents\/(snbAcc|snbAccIx)\/([^?]+)/.exec(url);
  if (!m) return { status: 404, json: async () => ({}) };
  if (fsDown) return { status: 503, json: async () => ({}) };
  const k = m[1] + '/' + m[2];
  if ((init.method || 'GET') === 'PATCH') { writes++; db.set(k, JSON.parse(init.body)); return { status: 200, json: async () => ({}) }; }
  return db.has(k) ? { status: 200, json: async () => db.get(k) } : { status: 404, json: async () => ({}) };
};
let NOW = Date.UTC(2026, 10, 6, 12, 0, 0);
const FB = { users: {}, down: false };   // מזהה Google / מייל → { uid, emails, gsubs }
const fb = {
  byEmail: async (e) => { if (FB.down) throw new Error('lookup_http_503'); return FB.users['e:' + e] || null; },
  byGoogle: async (g) => { if (FB.down) throw new Error('lookup_http_503'); return FB.users['g:' + g] || null; },
};
const mk = () => A.make({ fetch: fsFetch, token: async () => 'tk', now: () => NOW, seal: V.seal, open: V.open, ixKey: V.derive('snb-acc-ix/v1').key, fb });

/* Google מדומה: אסימון זהות חתום במפתח מקומי */
const gk = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KEYS = { k1: gk.publicKey };
const gTok = (c, key) => {
  const h = b64url(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' }));
  const now = Math.floor(NOW / 1000);
  const b = b64url(JSON.stringify(Object.assign({ iss: 'https://accounts.google.com', aud: 'cid.apps.googleusercontent.com', iat: now - 5, exp: now + 3600, nonce: 'n'.repeat(20) }, c)));
  return h + '.' + b + '.' + b64url(crypto.sign('RSA-SHA256', Buffer.from(h + '.' + b), key || gk.privateKey));
};

(async () => {
  /* ---------- 1. סיסמאות: scrypt ---------- */
  const h = await A.hashPw('correct horse');
  ok(h.N === 32768 && h.r === 8 && Buffer.from(h.s, 'base64').length === 16 && Buffer.from(h.h, 'base64').length === 32, 'scrypt: N=2^15, מלח 16, גיבוב 32');
  ok(await A.checkPw(h, 'correct horse') && !(await A.checkPw(h, 'correct horsE')) && !(await A.checkPw(null, 'correct horse')), 'scrypt: נכונה עוברת, שגויה ובלי רשומה — לא');
  ok(!(await A.checkPw(Object.assign({}, h, { N: 1 << 25 }), 'correct horse')), 'scrypt: פרמטרים חריגים ברשומה — לא (לא סומכים על המבנה)');
  ok(!A.pwValid('12345') && A.pwValid('123456') && !A.pwValid('x'.repeat(257)) && !A.pwValid(123456), 'אורך סיסמה 6–256, מחרוזת בלבד');
  ok(/^[A-Za-z0-9]{28}$/.test(A.newUid()) && A.newUid() !== A.newUid(), 'uid חדש — 28 תווים כמו של Firebase');

  /* ---------- 2. הרישום השקט והצפנה במנוחה ---------- */
  const acc = mk();
  await acc.observe({ uid: 'UidOld1', provider: 'google.com', emails: ['Old@Example.com'], gsubs: ['1234567890'] });
  const raw = JSON.stringify([...db.entries()]);
  ok(db.has('snbAcc/UidOld1') && db.size === 3, 'רישום: רשומה + אינדקס למייל + אינדקס ל־Google');
  ok(!/old@example\.com/i.test(raw) && !raw.includes('1234567890'), 'הצפנה במנוחה: אין מייל ואין מזהה Google גלוי (גם לא במזהי האינדקס)');
  const w0 = writes;
  await acc.observe({ uid: 'UidOld1', provider: 'google.com', emails: ['old@example.com'], gsubs: ['1234567890'] });
  ok(writes === w0, 'רישום חוזר של אותו דבר — בלי כתיבה (מטמון)');
  ok((await acc.observe({ uid: 'UidX', provider: 'custom', emails: ['x@example.com'] })) === null && !db.has('snbAcc/UidX'), 'טוקן מותאם — לא נרשם');
  const rec = await acc.get('UidOld1');
  ok(rec && rec.em[0] === 'old@example.com' && rec.g[0] === '1234567890', 'הרשומה נפתחת לבעלים');
  db.set('snbAcc/UidOther', db.get('snbAcc/UidOld1'));
  ok((await acc.get('UidOther')) === null, 'AAD: רשומה שהועתקה ל־uid אחר לא נפתחת');
  db.set('snbAcc/UidBad', { fields: { r: { stringValue: 'v1.s.AAAA.BBBB' } } });
  ok((await acc.get('UidBad')) === null && (await acc.get('../x')) === null, 'רשומה פגומה / מזהה לא תקין — כאילו אין');

  /* ---------- 3. כניסה עם Google: אצלנו → Firebase → חדש; נכשל סגור ---------- */
  ok((await acc.loginGoogle({ sub: '1234567890', email: 'old@example.com', verified: true })).uid === 'UidOld1', 'Google: מזהה מוכר — אותו uid');
  ok((await acc.loginGoogle({ sub: '5550000001', email: 'old@example.com', verified: true })).uid === 'UidOld1', 'Google: חשבון Google אחר עם אותו מייל מאומת — אותו חשבון');
  FB.users['g:777000111'] = { uid: 'FbUid22', emails: ['fb@example.com'], gsubs: ['777000111'] };
  const r1 = await acc.loginGoogle({ sub: '777000111', email: 'fb@example.com', verified: true });
  ok(r1.uid === 'FbUid22' && !r1.made && (await mk().get('FbUid22')).g.includes('777000111'), 'מעבר שקוף: משתמש של Firebase שעוד לא אצלנו — אותו uid, ונרשם');
  FB.down = true;
  let threw = '';
  try { await acc.loginGoogle({ sub: '888000111', email: 'new@example.com', verified: true }); } catch (e) { threw = e.message; }
  ok(/lookup/.test(threw), 'Firebase לא עונה ומשתמש לא מוכר — נכשל סגור (לא יוצר חשבון כפול)');
  FB.down = false;
  const r2 = await acc.loginGoogle({ sub: '888000111', email: 'new@example.com', verified: true });
  ok(r2.made && /^[A-Za-z0-9]{28}$/.test(r2.uid), 'Firebase: "אין כזה" — חשבון חדש');
  threw = '';
  try { await acc.loginGoogle({ sub: '999000111', email: 'old@example.com', verified: false }); } catch (e) { threw = e.message; }
  ok(threw === 'unverified', 'Google בלי מייל מאומת — לא מקשר ולא יוצר');

  /* ---------- 4. אימות אסימון Google ---------- */
  const vg = (t, o) => A.verifyGoogle(t, Object.assign({ aud: 'cid.apps.googleusercontent.com', nonce: 'n'.repeat(20), keys: KEYS, now: NOW }, o)).then((x) => x, (e) => e.message);
  const g1 = await vg(gTok({ sub: '42424242', email: 'A@b.co', email_verified: true }));
  ok(g1.sub === '42424242' && g1.email === 'a@b.co' && g1.verified, 'Google: אסימון תקין');
  ok((await vg(gTok({ sub: '42424242' }, crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey))) === 'bad_token', 'Google: חתימה מזויפת — נדחה');
  ok((await vg(gTok({ sub: '42424242', aud: 'other' }))) === 'wrong_aud', 'Google: aud של לקוח אחר — נדחה');
  ok((await vg(gTok({ sub: '42424242', exp: Math.floor(NOW / 1000) - 1 }))) === 'expired', 'Google: פג — נדחה');
  ok((await vg(gTok({ sub: '42424242', nonce: 'm'.repeat(20) }))) === 'nonce', 'Google: nonce אחר — נדחה');
  ok((await vg(gTok({ sub: '42424242', iss: 'https://evil.example' }))) === 'bad_token', 'Google: מנפיק זר — נדחה');
  const parts = gTok({ sub: '42424242' }).split('.');
  ok((await vg(b64url(JSON.stringify({ alg: 'none', kid: 'k1' })) + '.' + parts[1] + '.')) === 'bad_token', 'Google: alg none — נדחה');

  /* ---------- 5. סיסמה ---------- */
  await acc.setPw('UidOld1', 'old@example.com', 'pw-123456');
  ok(!JSON.stringify(db.get('snbAcc/UidOld1')).includes('pw-123456'), 'סיסמה: לא נשמרת גלויה');
  ok((await acc.loginPw('old@example.com', 'pw-123456')) === 'UidOld1' && (await acc.loginPw('OLD@example.com ', 'pw-123456')) === 'UidOld1', 'סיסמה נכונה — נכנס (מייל מנורמל)');
  ok((await acc.loginPw('old@example.com', 'pw-1234567')) === '' && (await acc.loginPw('nobody@example.com', 'pw-123456')) === '' && (await acc.loginPw('x', 'y')) === '', 'שגויה / מייל לא מוכר / קלט פגום — אותה תשובה ריקה');

  /* ---------- 6. הדגל ---------- */
  ok(SF.DEF_OFF.includes('acc_srv') && !SF.flagOn({}, 'acc_srv') && SF.flagOn({ flOn: 'acc_srv' }, 'acc_srv'), 'הדגל acc_srv כבוי כברירת מחדל, ונדלק במרכז הניהול');
  ok(S.accOn({ FIREBASE_PROJECT_ID: 'snowball-staging-758f6' }) && !S.accOn({ FIREBASE_PROJECT_ID: 'yishaiguedj1-c786e' })
    && S.accOn({ SNB_ACC: 'on' }) && !S.accOn({ FIREBASE_PROJECT_ID: 'snowball-staging-758f6', SNB_ACC: 'off' }), 'accOn: בניסוי דולק, בייצור לפי הדגל, SNB_ACC גובר');

  /* ---------- 7. הפעולות ב־session.js ---------- */
  let ON = false, minted = 0;
  const accH = mk();
  const H = S.makeHandler({ fetch: fsFetch, now: () => NOW, token: async () => 'tk', env: process.env, accOn: () => ON, acc: () => accH,
    sa: () => Object.assign({ project_id: 'yishaiguedj1-c786e' }, SA),
    verify: async (t) => { const m = /^fb:(\w+):(\d+):(\w+)$/.exec(t); if (!m) throw new Error('bad_token'); return { uid: m[1], authTime: Math.floor(NOW / 1000) - +m[2], provider: m[3], email: 'old@example.com', verified: true, linked: [], gsubs: [] }; },
    gExchange: async (code) => { if (code === 'bad') throw new Error('exchange_400'); return { idToken: code, aud: 'cid.apps.googleusercontent.com' }; },
    gKeys: KEYS });
  let ipN = 0;
  const call = async (body, ip) => {
    const res = { code: 0, h: {}, body: null, setHeader(k, v) { this.h[k.toLowerCase()] = v; }, getHeader(k) { return this.h[k.toLowerCase()]; },
      status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; }, end() { return this; } };
    await H({ method: 'POST', headers: { origin: 'https://invest.thesnowball.app', 'x-forwarded-for': ip || '10.1.0.' + (++ipN % 250) }, body }, res);
    return res;
  };
  const RED = 'https://invest.thesnowball.app/oauth.html', NONCE = 'n'.repeat(20);
  for (const op of S.ACC_OPS) { const r = await call({ op }); ok(r.body.error === 'off' && !r.h['set-cookie'], 'כבוי: ' + op + ' — off, בלי עוגייה'); }
  ON = true;
  ok((await call({ op: 'gLogin', code: gTok({ sub: '1234567890', email: 'old@example.com', email_verified: true }), redirect: 'https://evil.example/oauth.html', nonce: NONCE })).code === 400, 'gLogin: כתובת חזרה זרה — 400');
  ok((await call({ op: 'gLogin', code: 'bad', redirect: RED, nonce: NONCE })).body.error === 'bad_code', 'gLogin: קוד שנדחה ב־Google — bad_code');
  ok((await call({ op: 'gLogin', code: gTok({ sub: '1234567890', email: 'old@example.com', email_verified: true }), redirect: RED, nonce: 'z'.repeat(20) })).body.error === 'bad_token', 'gLogin: nonce לא תואם — נדחה');
  const g = await call({ op: 'gLogin', code: gTok({ sub: '1234567890', email: 'old@example.com', email_verified: true }), redirect: RED, nonce: NONCE });
  const ck = /^__Host-snb_s=([^;]+);.*HttpOnly; Secure; SameSite=Strict/.exec(g.h['set-cookie'] || '');
  ok(g.code === 200 && g.body.s === 1 && g.body.u === 'UidOld1' && ck && g.body.ct.split('.').length === 3, 'gLogin: אותו uid, עוגייה (HttpOnly/Secure/Strict) וטוקן מותאם לגיבוי');
  ok(JSON.stringify(g.body).indexOf('old@example.com') < 0, 'gLogin: התשובה בלי המייל');
  // סיסמה: נעילה אחרי 5 כישלונות למייל (גם מכתובות שונות)
  let last;
  for (let i = 0; i < 5; i++) last = await call({ op: 'pwLogin', email: 'old@example.com', password: 'wrong-pass' });
  ok(last.body.error === 'bad_login', 'pwLogin: שגויה — bad_login');
  ok((await call({ op: 'pwLogin', email: 'old@example.com', password: 'pw-123456' })).code === 429, 'pwLogin: אחרי 5 כישלונות — נעול גם עם הסיסמה הנכונה');
  NOW += 16 * 60e3;
  const pl = await call({ op: 'pwLogin', email: 'old@example.com', password: 'pw-123456' });
  ok(pl.body.ok && pl.body.u === 'UidOld1' && /__Host-snb_s=/.test(pl.h['set-cookie'] || ''), 'pwLogin: אחרי 15 דק׳ — נכנס, עוגייה');
  for (let i = 0; i < 20; i++) await call({ op: 'pwLogin', email: 'u' + i + '@example.com', password: 'wrong-pass' }, '10.9.9.9');
  ok((await call({ op: 'pwLogin', email: 'zz@example.com', password: 'wrong-pass' }, '10.9.9.9')).code === 429, 'pwLogin: 20 כישלונות מאותה כתובת — נעול');
  ok((await call({ op: 'pwSet', idToken: 'fb:UidOld1:3600:password', password: 'new-pass-1' })).body.error === 'not_fresh', 'pwSet: כניסה ישנה — נדחה');
  ok((await call({ op: 'pwSet', idToken: 'fb:UidOld1:10:custom', password: 'new-pass-1' })).body.error === 'not_fresh', 'pwSet: טוקן מותאם — נדחה');
  ok((await call({ op: 'pwSet', idToken: 'nope', password: 'new-pass-1' })).code === 401, 'pwSet: בלי טוקן תקין — 401');
  ok((await call({ op: 'pwSet', idToken: 'fb:UidOld1:10:password', password: '123' })).body.error === 'bad_password', 'pwSet: סיסמה קצרה — נדחה');
  ok((await call({ op: 'pwSet', idToken: 'fb:UidOld1:10:password', password: 'new-pass-1' })).body.ok
    && (await call({ op: 'pwLogin', email: 'old@example.com', password: 'new-pass-1' })).body.u === 'UidOld1', 'pwSet: כניסה טרייה — הסיסמה החדשה עובדת');
  ok((await call({ op: 'accReg', idToken: 'fb:UidReg9:9999:password' })).body.ok && !!(await mk().get('UidReg9')), 'accReg: טוקן Firebase מאומת — נרשם (גם לא טרי)');
  ok((await call({ op: 'accReg', idToken: 'zzz' })).code === 401, 'accReg: טוקן לא תקין — 401');
  fsDown = true;
  ok((await call({ op: 'pwLogin', email: 'old@example.com', password: 'new-pass-1' })).body.error === 'store', 'תקלה במסד — store, בלי עוגייה');
  fsDown = false;
  // GET סטטוס: מונים בלבד
  const gs = { h: {}, setHeader(k, v) { this.h[k] = v; }, status() { return this; }, json(o) { this.body = o; return this; } };
  await H({ method: 'GET', headers: {} }, gs);
  const st = JSON.stringify(gs.body);
  ok(!/example\.com|Uid|1234567890/.test(st), 'GET /api/session — בלי מיילים, uid או מזהי Google');

  console.log('\n' + (n - bad) + '/' + n + ' passed');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
