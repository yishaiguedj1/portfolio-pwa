/* שלב 2, גל 3 (7/11/2026) — אסימון הגישה שלנו: ibkr-proxy/lib/snbat.js, הקבלה ב־gauth.verifyIdToken, הפעולה at ב־session.js,
   הקשר לאפליקציה ב־appscope, הוספת מייל בקוד וסיסמה אחרי איפוס (accounts.js). בלי רשת: חשבון שירות מקומי, Firestore מדומה.
   האבטחה (docs/privacy.md, "מערכות משלנו"): alg קבוע (none/RS256/HS512 נדחים), חתימה, aud, exp, ביטול ב־vs, Vercel דוחה,
   כבוי = לא מונפק ולא מתקבל, בלי המפתח/האסימון/הקוד בסטטוס. */
'use strict';
const crypto = require('crypto');
const path = require('path');

let n = 0, bad = 0;
const ok = (c, m) => { n++; if (c) console.log('ok - ' + m); else { bad++; console.log('FAIL - ' + m); } };

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = { type: 'service_account', project_id: 'yishaiguedj1-c786e', client_email: 'sa@yishaiguedj1-c786e.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
process.env.GDRIVE_SA_KEY = JSON.stringify(SA);
process.env.FIREBASE_PROJECT_ID = 'yishaiguedj1-c786e';
delete process.env.IBKR_VAULT_KEY; delete process.env.SNB_ACC; delete process.env.SNB_SESSION_ENV; delete process.env.VERCEL;

const L = (f) => require(path.join(__dirname, '..', 'ibkr-proxy', 'lib', f));
const T = L('snbat.js'), G = L('gauth.js'), S = L('session.js'), A = L('accounts.js'), V = L('vault.js'), AS = L('appscope.js');
const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const unb = (s) => JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

let NOW = Date.UTC(2026, 10, 7, 12, 0, 0);
const sec = () => Math.floor(NOW / 1000);
const KEY = crypto.randomBytes(32);
const vs0 = async () => 0;
const ver = (t, o) => T.verify(t, Object.assign({ key: KEY, now: NOW, vs: vs0 }, o)).then((x) => x, (e) => 'ERR:' + e.message);
const hs = (head, claims, key) => { const h = b64url(JSON.stringify(head)), b = b64url(JSON.stringify(claims)); return h + '.' + b + '.' + b64url(crypto.createHmac('sha256', key || KEY).update(h + '.' + b).digest()); };

(async () => {
  /* ---------- 1. הנפקה ואימות ---------- */
  const t1 = T.issue({ uid: 'UidA1', app: 'invest', vs: sec() - 100, em: ['A@Example.com', 'bad', 'b@example.com'], now: NOW, key: KEY });
  const [h1, c1] = t1.at.split('.');
  ok(h1 === T.HEAD && JSON.stringify(unb(h1)) === JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: 'snb-at/1' }), 'כותרת קבועה: HS256 + kid שלנו');
  const cl = unb(c1);
  ok(cl.sub === 'UidA1' && cl.aud === 'snb:invest' && cl.app === 'invest' && cl.exp - cl.iat === 15 * 60 && t1.exp === cl.exp, 'בתוכו: uid, aud לפי אפליקציה, תפוגה של 15 דק׳');
  ok(JSON.stringify(cl.em) === '["a@example.com","b@example.com"]', 'רק מיילים תקינים, באותיות קטנות');
  const u1 = await ver(t1.at);
  ok(u1.uid === 'UidA1' && u1.email === 'a@example.com' && u1.verified && u1.linked[0] === 'b@example.com' && u1.provider === 'snb' && u1.app === 'invest' && u1.own, 'אימות: משתמש בצורה של verifyIdToken');
  ok(G.hasEmail(u1, ['b@example.com']), 'הרשאה לפי מייל (hasEmail) עובדת גם עם האסימון שלנו');
  let thr = ''; try { T.issue({ uid: 'UidA1', app: 'evil', vs: 1, now: NOW, key: KEY }); } catch (e) { thr = e.message; }
  ok(thr === 'bad_app', 'הנפקה רק לאפליקציה מהרשימה');

  /* ---------- 2. דחיות ---------- */
  NOW += 15 * 60e3 + 1000;
  ok((await ver(t1.at)) === 'ERR:expired', 'פג תוקף — נדחה');
  NOW -= 15 * 60e3 + 1000;
  ok((await ver(t1.at, { key: crypto.randomBytes(32) })) === 'ERR:bad_token', 'חתימה במפתח אחר — נדחה');
  const p = t1.at.split('.');
  const flip = p[2].slice(0, -2) + (p[2].slice(-2) === 'AA' ? 'AB' : 'AA');
  ok((await ver(p[0] + '.' + p[1] + '.' + flip)) === 'ERR:bad_token', 'חתימה ששונתה — נדחה');
  const forged = b64url(JSON.stringify(Object.assign({}, cl, { sub: 'UidB2' })));
  ok((await ver(p[0] + '.' + forged + '.' + p[2])) === 'ERR:bad_token', 'תוכן ששונה (uid אחר) עם אותה חתימה — נדחה');
  ok((await ver(t1.at, { aud: 'studio' })) === 'ERR:bad_token', 'aud של אפליקציה אחרת — נדחה');
  ok((await ver(hs({ alg: 'HS256', typ: 'JWT', kid: 'snb-at/1' }, Object.assign({}, cl, { aud: 'snb:studio' })))) === 'ERR:bad_token', 'aud שלא תואם ל־app (גם בחתימה נכונה) — נדחה');
  ok((await ver(hs({ alg: 'HS256', typ: 'JWT', kid: 'snb-at/1' }, Object.assign({}, cl, { aud: 'snb:evil', app: 'evil' })))) === 'ERR:bad_token', 'אפליקציה לא מוכרת — נדחה');
  ok((await ver(b64url(JSON.stringify({ alg: 'none', typ: 'JWT', kid: 'snb-at/1' })) + '.' + p[1] + '.')) === 'ERR:bad_token', 'alg none — נדחה');
  ok((await ver(hs({ alg: 'HS512', typ: 'JWT', kid: 'snb-at/1' }, cl))) === 'ERR:bad_token', 'alg אחר — נדחה');
  ok((await ver(hs({ typ: 'JWT', alg: 'HS256', kid: 'snb-at/1' }, cl))) === 'ERR:bad_token', 'כותרת בסדר אחר (לא הקבועה) — נדחה');
  ok((await ver(hs({ alg: 'HS256', typ: 'JWT', kid: 'snb-at/1' }, Object.assign({}, cl, { exp: cl.iat + 86400 })))) === 'ERR:expired', 'תפוגה ארוכה מהמותר — נדחה');
  ok((await ver(hs({ alg: 'HS256', typ: 'JWT', kid: 'snb-at/1' }, Object.assign({}, cl, { p: 'other-proj' })))) === 'ERR:wrong_project', 'פרויקט אחר (ניסוי מול ייצור) — נדחה');
  ok((await ver(hs({ alg: 'HS256', typ: 'JWT', kid: 'snb-at/1' }, Object.assign({}, cl, { iss: 'x' })))) === 'ERR:bad_token', 'מנפיק אחר — נדחה');

  /* ---------- 3. ביטול: vs ---------- */
  ok((await ver(t1.at, { vs: async () => sec() })) === 'ERR:revoked', 'התנתקות מכל המכשירים אחרי ההנפקה — נדחה');
  ok((await ver(t1.at, { vs: async () => sec() - 100 })).uid === 'UidA1', 'vs שווה — תקף');
  ok((await ver(t1.at, { vs: async () => { throw new Error('fs'); } })) === 'ERR:revoked', 'תקלה בקריאת vs — נדחה (נכשל סגור)');

  /* ---------- 4. gauth.verifyIdToken: רק בשרת שלנו, רק כשדולק ---------- */
  const gv = (t, o) => G.verifyIdToken(t, Object.assign({ atKey: KEY, now: NOW, vs: vs0, keys: {} }, o)).then((x) => x, (e) => 'ERR:' + e.message);
  ok((await gv(t1.at, { ownOn: true })).uid === 'UidA1', 'בשרת שלנו, דולק — מתקבל');
  ok((await gv(t1.at, { ownOn: false })) === 'ERR:bad_token', 'כבוי (acc_srv) — נדחה');
  ok((await gv(t1.at, { ownOn: true, own: false })) === 'ERR:bad_token', 'own:false (הכניסות ב־session.js) — נדחה');
  process.env.VERCEL = '1';
  ok((await gv(t1.at, { ownOn: true })) === 'ERR:bad_token', 'Vercel דוחה את האסימון שלנו (Firebase בלבד)');
  delete process.env.VERCEL;
  ok((await gv(b64url(JSON.stringify({ alg: 'none' })) + '.' + p[1] + '.', { ownOn: true })) === 'ERR:bad_token', 'verifyIdToken: alg none — נדחה');
  ok((await gv(t1.at.replace(T.HEAD, b64url(JSON.stringify({ alg: 'RS256', kid: 'snb-at/1' }))), { ownOn: true })) === 'ERR:bad_token', 'verifyIdToken: החלפת alg ל־RS256 — נדחה');

  /* ---------- 5. appscope: האסימון קשור לאפליקציה ---------- */
  const rq = (o) => ({ url: '/api/udata', headers: { origin: o } });
  ok(AS.appDenied(rq('https://studio.thesnowball.app'), { op: 'x', idToken: t1.at }, process.env) === 'wrong_app', 'אסימון של invest ממקור של studio — wrong_app');
  ok(AS.appDenied(rq('https://invest.thesnowball.app'), { op: 'x', idToken: t1.at }, process.env) === '', 'אסימון של invest מ־invest — מותר');

  /* ---------- 6. session.js: at / who / logout ---------- */
  const db = new Map();
  const fsFetch = async (url, init = {}) => {
    const m = /documents\/(snbAcc|snbAccIx|sessions|authCodes)\/([^?]+)/.exec(url);
    if (!m) return { status: 404, json: async () => ({}) };
    const k = m[1] + '/' + m[2];
    if ((init.method || 'GET') === 'PATCH') { const b = JSON.parse(init.body); db.set(k, /updateMask/.test(url) ? { fields: Object.assign({}, (db.get(k) || {}).fields, b.fields) } : b); return { status: 200, json: async () => ({}) }; }   // כמו Firestore: בלי updateMask — מחליף
    return db.has(k) ? { status: 200, json: async () => db.get(k) } : { status: 404, json: async () => ({}) };
  };
  const FB = { users: {}, pu: {} };
  const fb = { byEmail: async (e) => FB.users['e:' + e] || null, byGoogle: async () => null, pwAt: async (uid) => FB.pu[uid] || 0 };
  const acc = A.make({ fetch: fsFetch, token: async () => 'tk', now: () => NOW, seal: V.seal, open: V.open, ixKey: V.derive('snb-acc-ix/v1').key, fb });
  let ON = true;
  const mails = [];
  const H = S.makeHandler({ fetch: fsFetch, now: () => NOW, token: async () => 'tk', env: process.env, accOn: () => ON, acc: () => acc,
    sa: () => SA, verify: async () => { throw new Error('bad_token'); },
    mail: async (m) => { mails.push(m); return { ok: true, via: 'x' }; }, oob: async () => ({ link: 'https://x/l', oobCode: 'OOB1' }),
    render: (kind, lang, o) => ({ subject: 's', text: o.code, html: o.code }) });
  let ipN = 0;
  const call = async (body, cookie, origin) => {
    const res = { code: 0, h: {}, body: null, setHeader(k, v) { this.h[k.toLowerCase()] = v; }, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; }, end() { return this; } };
    await H({ method: 'POST', headers: { origin: origin || 'https://invest.thesnowball.app', 'x-forwarded-for': '10.2.0.' + (++ipN % 250), cookie: cookie ? S.COOKIE + '=' + cookie : '' }, body }, res);
    return res;
  };
  await acc.observe({ uid: 'UidA1', emails: ['a@example.com'], gsubs: [] });
  const key = S.cookieKey(process.env);
  const ck = S.sealCookie({ u: 'UidA1', a: sec(), i: sec(), x: sec() + 3600, p: 'yishaiguedj1-c786e' }, key);
  const realVer = (t) => G.verifyIdToken(t, { now: NOW, ownOn: true, keys: {}, vs: (uid) => S.readVs(uid, { now: () => NOW, token: async () => 'tk', fetch: fsFetch }, T.VS_TTL_MS) });
  let r = await call({ op: 'at' }, ck);
  ok(r.body.ok && r.body.s === 1 && r.body.at && r.body.atx > sec() && r.body.u === 'UidA1', 'at: מהעוגייה — אסימון שלנו');
  ok(unb(r.body.at.split('.')[1]).aud === 'snb:invest', 'at: aud לפי המקור (invest)');
  ok((await realVer(r.body.at)).uid === 'UidA1', 'האסימון שהונפק מתקבל באימות (המפתח מהכספת)');
  const atA = r.body.at;
  const w = await call({ op: 'who' }, ck, 'https://studio.thesnowball.app');
  ok(w.body.s === 1 && w.body.ct && unb(w.body.at.split('.')[1]).app === 'studio', 'who: גם אסימון שלנו, לאפליקציה של המקור');
  ok((await call({ op: 'at' })).body.s === 0, 'at בלי עוגייה — s:0');
  ok((await call({ op: 'at' }, ck.slice(0, -2) + 'xx')).body.s === 0, 'at עם עוגייה מזויפת — s:0');
  r = await call({ op: 'at' }, S.sealCookie({ u: 'NoAcc9', a: sec(), i: sec(), x: sec() + 3600, p: 'yishaiguedj1-c786e' }, key));
  ok(r.code === 503 && !r.body.at, 'חשבון שלא רשום אצלנו — בלי אסימון (הטלפון ממשיך עם Firebase)');
  ON = false;
  r = await call({ op: 'at' }, ck);
  ok(r.body.error === 'off' && !r.body.at, 'כבוי: at — off');
  r = await call({ op: 'who' }, ck);
  ok(r.body.s === 1 && r.body.ct && !('at' in r.body), 'כבוי: who כמו היום, בלי אסימון שלנו');
  ON = true;
  NOW += 5000;
  r = await call({ op: 'logout', all: true }, ck);
  ok(r.body.all === true, 'logout all');
  ok((await realVer(atA).then((x) => x, (e) => 'ERR:' + e.message)) === 'ERR:revoked', 'ביטול: אסימון מלפני ההתנתקות מכל המכשירים — נדחה');
  ok((await call({ op: 'at' }, ck)).body.s === 0, 'ביטול: אחרי logout — at לא מנפיק מהעוגייה הישנה');
  // סטטוס: בלי האסימון, המפתח או הקוד
  const gs = { h: {}, setHeader(k, v) { this.h[k] = v; }, status() { return this; }, json(o) { this.body = o; return this; } };
  await H({ method: 'GET', headers: {} }, gs);
  const st = JSON.stringify(gs.body);
  ok(st.indexOf(atA.split('.')[2]) < 0 && !/UidA1|example\.com/.test(st) && /at:ok/.test(st), 'GET /api/session — מונים בלבד (at:ok), בלי אסימון או uid');

  /* ---------- 7. הוספת מייל לחשבון: קוד במייל → snbAcc ---------- */
  NOW += 2000;   // עוגייה חדשה אחרי ההתנתקות
  const ck2 = S.sealCookie({ u: 'UidA1', a: sec(), i: sec(), x: sec() + 3600, p: 'yishaiguedj1-c786e' }, key);
  ok((await call({ op: 'mailSend', kind: 'in', email: 'new@example.com' })).body.sent, 'mailSend: קוד נשלח');
  const code = String(mails[mails.length - 1].text);
  r = await call({ op: 'mailCode', email: 'new@example.com', code: code === '000000' ? '111111' : '000000', add: 1 }, ck2);
  ok(r.body.error === 'bad_code', 'קוד שגוי — לא מוסיף');
  r = await call({ op: 'mailCode', email: 'new@example.com', code, add: 1 }, ck2);
  ok(r.body.ok && r.body.added === true && r.body.oc === 'OOB1' && !r.h['set-cookie'] && !r.body.s, 'add: המייל נוסף לחשבון המחובר — בלי כניסה ובלי עוגייה חדשה');
  ok((await acc.get('UidA1')).em.includes('new@example.com'), 'snbAcc: המייל נשמר ברשומה');
  ok((await call({ op: 'mailCode', email: 'new@example.com', code, add: 1 }, ck2)).body.error === 'expired', 'קוד חד־פעמי — שימוש שני נדחה');
  await acc.observe({ uid: 'UidB2', emails: ['b2@example.com'], gsubs: [] });
  await call({ op: 'mailSend', kind: 'in', email: 'b2@example.com' });
  r = await call({ op: 'mailCode', email: 'b2@example.com', code: String(mails[mails.length - 1].text), add: 1 }, ck2);
  ok(r.body.added === false && !(await acc.get('UidA1')).em.includes('b2@example.com'), 'מייל של חשבון אחר — לא נוסף (המיזוג דרך Firebase)');
  for (let i = 0; i < 4; i++) await call({ op: 'mailSend', kind: 'in', email: 'rate@example.com' });
  ok((await call({ op: 'mailSend', kind: 'in', email: 'rate@example.com' })).body.sent && (await call({ op: 'mailSend', kind: 'in', email: 'rate@example.com' })).code === 429, 'הגבלת קצב לשליחת קוד (5 בשעה למייל)');
  await call({ op: 'mailSend', kind: 'in', email: 'try@example.com' });
  const good = String(mails[mails.length - 1].text), wrong = good === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) await call({ op: 'mailCode', email: 'try@example.com', code: wrong, add: 1 }, ck2);
  ok((await call({ op: 'mailCode', email: 'try@example.com', code: good, add: 1 }, ck2)).body.error === 'tries', 'הגבלה לאימות קוד: אחרי 5 ניסיונות — גם הנכון נדחה');
  NOW += 11 * 60e3;
  await call({ op: 'mailSend', kind: 'in', email: 'old2@example.com' });
  const c2 = String(mails[mails.length - 1].text);
  NOW += 11 * 60e3;
  ok((await call({ op: 'mailCode', email: 'old2@example.com', code: c2, add: 1 }, ck2)).body.error === 'expired', 'קוד פג אחרי 10 דקות');
  ok(!/\d{6}/.test(JSON.stringify(gs.body)), 'הקוד לא בסטטוס');

  /* ---------- 8. סיסמה אחרי איפוס ב־Firebase ---------- */
  await acc.setPw('UidA1', 'a@example.com', 'old-pass-1');
  ok((await acc.loginPw('a@example.com', 'old-pass-1')) === 'UidA1' && (await acc.pwState('UidA1')) === 1, 'סיסמה אצלנו — נכנסת, pwState=1');
  FB.pu.UidA1 = NOW + 60e3;
  NOW += 120e3;
  ok((await acc.loginPw('a@example.com', 'old-pass-1')) === '', 'אחרי איפוס ב־Firebase — הסיסמה הישנה נדחית');
  ok((await acc.get('UidA1')).pw === null && (await acc.pwState('UidA1')) === 0, 'והיא נמחקה אצלנו — pwState=0 (הטלפון ישלח pwSet)');
  await acc.setPw('UidA1', 'a@example.com', 'new-pass-2');
  ok((await acc.loginPw('a@example.com', 'new-pass-2')) === 'UidA1', 'pwSet אחרי האיפוס — החדשה עובדת');

  console.log('\n' + (n - bad) + '/' + n + ' passed');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
