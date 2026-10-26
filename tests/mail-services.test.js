/* שליחת מיילים משלנו + עמוד השירותים (26/10/2026, שלבים 1–2 ב־תוכנית-עמידות-שירותים.md).
   lib/mailer.js (שרשרת שירותים חינמיים, מונים, תבניות), lib/session.js (mailSend / mailCode — קוד בן 6 ספרות),
   lib/services.js (כל השירותים: מצב, אחוז, גיבוי; התראה מ־70%). בלי רשת: fetch מדומה, Firestore בזיכרון. */
'use strict';
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

let n = 0, bad = 0;
const ok = (c, m) => { n++; if (c) console.log('ok - ' + m); else { bad++; console.log('FAIL - ' + m); } };

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.GDRIVE_SA_KEY = JSON.stringify({ type: 'service_account', client_email: 'sa@yishaiguedj1-c786e.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
process.env.FIREBASE_PROJECT_ID = 'yishaiguedj1-c786e';
for (const k of ['BREVO_API_KEY', 'MAILJET_API_KEY', 'MAILJET_SECRET_KEY', 'RESEND_API_KEY', 'SMTP2GO_API_KEY', 'SNB_SESSION_ENV', 'SNB_SESSION_KEY', 'MAIL_FROM']) delete process.env[k];

const P = (f) => path.join(__dirname, '..', 'ibkr-proxy', 'lib', f);
const M = require(P('mailer.js'));
const S = require(P('session.js'));
const SVC = require(P('services.js'));
const NOW = Date.UTC(2026, 9, 26, 10, 0, 0);

/* ---------------------------------------------------------------- 1. המונים והסדר (טהור) */
{
  const keys = { brevo: 'b', resend: 'r' };
  ok(M.plan(keys, M.countsOf({}, NOW), NOW).join() === 'brevo,resend', 'הסדר: רק שירותים עם מפתח, לפי הסדר הקבוע');
  ok(M.plan({}, M.countsOf({}, NOW), NOW).length === 0, 'בלי מפתחות — אין למי לשלוח');
  let c = {};
  for (let i = 0; i < 270; i++) c = M.bump(c, 'brevo', NOW);
  ok(M.countsOf(c, NOW).brevo.day === 270 && M.plan(keys, M.countsOf(c, NOW), NOW).join() === 'resend', 'ב־90% מהמכסה היומית (270 מתוך 300) — עוברים לבא');
  ok(M.countsOf(c, NOW + 864e5).brevo.day === 0 && M.countsOf(c, NOW + 864e5).brevo.month === 270, 'יום חדש — המונה היומי מתאפס, החודשי נשאר');
  const c2 = M.bump({}, 'brevo', NOW, 'quota');
  ok(M.plan(keys, M.countsOf(c2, NOW), NOW).join() === 'resend' && M.plan(keys, M.countsOf(c2, NOW + 61 * 60e3), NOW + 61 * 60e3).join() === 'brevo,resend', 'שירות שסירב (מכסה) — שעה בצד ואז חוזר');
  const c3 = M.bump({}, 'brevo', NOW, 'net');
  ok(M.plan(keys, M.countsOf(c3, NOW), NOW)[0] === 'brevo', 'תקלת רשת לא מוציאה את השירות מהתור');
  ok(M.countsOf(M.bump(c2, 'brevo', NOW), NOW).brevo.err === '', 'שליחה מוצלחת מנקה את השגיאה');
  ok(M.errCode(429) === 'quota' && M.errCode(402) === 'quota' && M.errCode(401) === 'denied' && M.errCode(403) === 'denied' && M.errCode(400) === 'bad' && M.errCode(500) === 'net' && M.errCode(0) === 'net', 'קודי שגיאה');
}

/* ---------------------------------------------------------------- 2. הבקשה לכל שירות + המפתחות */
{
  const m = { to: 'a@example.com', subject: 'S', html: '<b>h</b>', text: 't' };
  const b = M.request('brevo', 'K', m), j = M.request('mailjet', 'K1:S1', m), r = M.request('resend', 'K', m), s = M.request('smtp2go', 'K', m);
  ok(b.url === 'https://api.brevo.com/v3/smtp/email' && b.headers['api-key'] === 'K' && b.body.sender.email === 'noreply@thesnowball.app' && b.body.to[0].email === m.to, 'Brevo: הכתובת, המפתח והשולח מהדומיין שלנו');
  ok(j.headers.Authorization === 'Basic ' + Buffer.from('K1:S1').toString('base64') && j.body.Messages[0].To[0].Email === m.to, 'Mailjet: Basic עם key:secret');
  ok(r.headers.Authorization === 'Bearer K' && r.body.from === 'THE SNOWBALL <noreply@thesnowball.app>', 'Resend: Bearer והשולח');
  ok(s.headers['X-Smtp2go-Api-Key'] === 'K' && s.body.to[0] === m.to, 'SMTP2GO');
  ok(M.normKey('brevo', ' xkeysib-abc ') === 'xkeysib-abc' && M.normKey('brevo', 'a b') === '' && M.normKey('brevo', '<x>') === '' && M.normKey('brevo', 'x'.repeat(301)) === '', 'מפתח: חותכים רווחים, דוחים רווח בפנים / תגיות / ארוך');
  ok(M.normKey('mailjet', 'abc') === '' && M.normKey('mailjet', 'a:b') === 'a:b', 'Mailjet דורש key:secret');
  ok(M.EMAIL_RE.test('a.b@example.com') && !M.EMAIL_RE.test('a@b') && !M.EMAIL_RE.test('a b@example.com') && !M.EMAIL_RE.test('<a@example.com>'), 'בדיקת כתובת מייל');
}

/* ---------------------------------------------------------------- 3. התבניות */
{
  const t = M.render('in', 'he', { code: '012345', link: 'https://x.example.com/?a=1&b=2' });
  ok(t.subject.includes('012345') && t.html.includes('dir="rtl"') && t.html.includes('012345') && t.html.includes('&amp;b=2') && t.text.includes('012345'), 'כניסה: הקוד בנושא ובגוף, RTL, הקישור מוברח');
  const e = M.render('reset', 'en', { link: 'javascript:alert(1)' });
  ok(!e.html.includes('javascript') && e.html.includes('dir="ltr"') && !/<a /.test(e.html), 'קישור שאינו https לא נכנס למייל');
  const x = M.render('in', 'he', { code: '<script>1' });
  ok(!x.html.includes('<script'), 'הקוד — רק ספרות');
  ok(M.render('test', 'he', {}).subject && M.render('verify', 'en', { link: 'https://a.example.com' }).html.includes('https://a.example.com'), 'בדיקה ואימות');
}

/* ---------------------------------------------------------------- 4. השליחה בשרשרת (fetch מדומה) */
(async () => {
  const doc = new Map();
  const answers = {};
  const sent = [];
  const fakeFetch = async (url, init = {}) => {
    const fsm = /documents(\/[^?]+)/.exec(url);
    if (fsm) {
      if ((init.method || 'GET') === 'PATCH') { const cur = doc.get(fsm[1]) || {}; doc.set(fsm[1], Object.assign(cur, JSON.parse(init.body).fields)); return { status: 200, json: async () => ({}) }; }
      if (!doc.has(fsm[1])) return { status: 404, json: async () => ({}) };
      return { status: 200, json: async () => ({ fields: doc.get(fsm[1]) }) };
    }
    const host = new URL(url).host;
    sent.push(host);
    const st = answers[host] == null ? 200 : answers[host];
    return { status: st, json: async () => (host === 'api.smtp2go.com' ? { data: { succeeded: 1 } } : {}) };
  };
  const md = { fetch: fakeFetch, token: async () => 'tk' };
  const msg = Object.assign({ to: 'u@example.com' }, M.render('test', 'he', {}));

  M._reset();
  let r = await M.send(md, msg, NOW);
  ok(!r.ok && r.error === 'no_provider', 'בלי מפתחות — no_provider (והטלפון חוזר ל־Firebase)');

  process.env.BREVO_API_KEY = 'kb'; process.env.RESEND_API_KEY = 'kr';
  M._reset();
  r = await M.send(md, msg, NOW);
  ok(r.ok && r.via === 'brevo' && sent[sent.length - 1] === 'api.brevo.com', 'נשלח דרך הראשון בתור');
  M._reset();
  r = await M.send(md, msg, NOW);
  const c = doc.get('/sysMail/c');
  ok(c && c.brevoD.integerValue === '2' && c.d.stringValue === '2026-10-26', 'המונה נשמר ב־sysMail/c ונקרא מחדש');

  answers['api.brevo.com'] = 429; sent.length = 0;
  M._reset();
  r = await M.send(md, msg, NOW);
  ok(r.ok && r.via === 'resend' && r.tried.join() === 'brevo:quota' && sent.join() === 'api.brevo.com,api.resend.com', 'מכסה בראשון — עוברים לבא באותה שליחה');
  sent.length = 0;
  r = await M.send(md, msg, NOW + 60e3);
  ok(r.ok && r.via === 'resend' && sent.join() === 'api.resend.com', 'השירות שסירב לא נוסה שוב בשעה הקרובה');
  answers['api.resend.com'] = 500;
  M._reset();
  r = await M.send(md, msg, NOW + 120e3);
  ok(!r.ok && r.error === 'all_failed', 'כולם נכשלו — all_failed');
  r = await M.send(md, Object.assign({}, msg, { to: 'not-an-email' }), NOW);
  ok(!r.ok && r.error === 'bad_email' , 'כתובת לא תקינה לא נשלחת');

  M._reset();
  const v = await M.view(md, NOW + 120e3);
  ok(v.from === 'noreply@thesnowball.app' && v.list.length === 4 && v.list[0].on && !v.list[1].on && v.list[0].err === 'quota', 'מצב לממשק: מי מוגדר, המונים והשגיאה');
  ok(!JSON.stringify(v).includes('kb') && !JSON.stringify(v).includes('kr'), 'המצב לא כולל מפתחות');
  delete process.env.BREVO_API_KEY; delete process.env.RESEND_API_KEY;

  /* ---------------------------------------------------------------- 5. mailSend / mailCode בשרתון */
  const codes = new Map();
  let mailed = [], oobFail = '', mailOk = true;
  const sessFetch = async (url, init = {}) => {
    const m = /authCodes\/([^?]+)/.exec(url);
    if (!m) return { status: 404, json: async () => ({}) };
    if ((init.method || 'GET') === 'PATCH') { codes.set(m[1], JSON.parse(init.body).fields); return { status: 200, json: async () => ({}) }; }
    if (!codes.has(m[1])) return { status: 404, json: async () => ({}) };
    return { status: 200, json: async () => ({ fields: codes.get(m[1]) }) };
  };
  let T = NOW;
  const H = S.makeHandler({
    fetch: sessFetch, now: () => T, token: async () => 'tk', env: process.env,
    verify: async (t) => (t === 'unv' ? { uid: 'u9', email: 'v@example.com', verified: false } : { uid: 'u9', email: 'v@example.com', verified: true }),
    oob: async (kind, email, url) => { if (oobFail) throw new Error(oobFail); return { link: url + '?mode=signIn&oobCode=OC-' + kind + '-' + email, oobCode: 'OC-' + kind + '-' + email }; },
    mail: async (m) => { mailed.push(m); return mailOk ? { ok: true, via: 'brevo' } : { ok: false, error: 'all_failed' }; },
  });
  let ipN = 0;
  const call = async (body, ip) => {
    const res = { code: 0, h: {}, body: null, setHeader(k, v) { this.h[k.toLowerCase()] = v; }, getHeader(k) { return this.h[k.toLowerCase()]; },
      status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; }, end() { return this; } };
    await H({ method: 'POST', headers: { origin: 'https://invest.thesnowball.app', 'x-forwarded-for': ip || '10.1.0.' + (++ipN % 250) }, body }, res);
    return res;
  };
  const codeIn = (m) => (/(\d{6})/.exec(m.subject) || [])[1];

  let res = await call({ op: 'mailSend', kind: 'in', email: 'A@Example.com', lang: 'he', path: '/academy.html' });
  ok(res.code === 200 && res.body.ok && res.body.code === true && mailed.length === 1, 'כניסה: נשלח מייל עם קוד');
  const m1 = mailed[0], code1 = codeIn(m1);
  ok(m1.to === 'a@example.com' && /^\d{6}$/.test(code1) && m1.html.includes('https://invest.thesnowball.app/academy.html?mode=signIn'), 'למייל באותיות קטנות, קוד בן 6 ספרות, הקישור לאפליקציה שממנה נשלח');
  const stored = JSON.stringify([...codes.values()]);
  ok(!stored.includes(code1) && !stored.includes('OC-in-') && !stored.includes('a@example.com'), 'במסמך: בלי הקוד, בלי ה־oobCode ובלי המייל — רק HMAC והצפנה');

  res = await call({ op: 'mailCode', email: 'a@example.com', code: code1 === '000000' ? '111111' : '000000' });
  ok(res.body.ok === false && res.body.error === 'bad_code' && res.body.left === 4, 'קוד שגוי — נשארו 4 ניסיונות');
  res = await call({ op: 'mailCode', email: 'a@example.com', code: code1 });
  ok(res.body.ok && res.body.oc === 'OC-in-a@example.com', 'קוד נכון — מחזיר את ה־oobCode לכניסה');
  res = await call({ op: 'mailCode', email: 'a@example.com', code: code1 });
  ok(res.body.ok === false && res.body.error === 'expired', 'שימוש אחד — בפעם השנייה כבר לא בתוקף');

  mailed = [];
  await call({ op: 'mailSend', kind: 'in', email: 'b@example.com' });
  const code2 = codeIn(mailed[0]);
  const wrong = code2 === '999999' ? '888888' : '999999';
  for (let i = 0; i < 5; i++) await call({ op: 'mailCode', email: 'b@example.com', code: wrong });
  res = await call({ op: 'mailCode', email: 'b@example.com', code: code2 });
  ok(res.body.ok === false && res.body.error === 'tries', 'אחרי 5 ניסיונות שגויים — גם הקוד הנכון נחסם');

  mailed = [];
  await call({ op: 'mailSend', kind: 'in', email: 'c@example.com' });
  const code3 = codeIn(mailed[0]);
  T = NOW + 11 * 60e3;
  res = await call({ op: 'mailCode', email: 'c@example.com', code: code3 });
  ok(res.body.ok === false && res.body.error === 'expired', 'אחרי 10 דקות הקוד פג');
  T = NOW;

  mailed = [];
  let last;
  for (let i = 0; i < 6; i++) last = await call({ op: 'mailSend', kind: 'reset', email: 'd@example.com' });
  ok(mailed.length === 5 && last.code === 429 && last.body.error === 'rate', 'עד 5 מיילים בשעה לאותה כתובת');
  ok(!/\d{6}/.test(mailed[0].subject) && mailed[0].html.includes('mode=signIn') === true, 'איפוס — בלי קוד, רק קישור');

  let lastIp;
  for (let i = 0; i < 11; i++) lastIp = await call({ op: 'mailSend', kind: 'in', email: 'ip' + i + '@example.com' }, '10.9.9.9');
  ok(lastIp.code === 429, 'עד 10 שליחות בשעה מאותה כתובת IP');

  oobFail = 'no_user'; mailed = [];
  res = await call({ op: 'mailSend', kind: 'reset', email: 'nobody@example.com' });
  ok(res.code === 200 && res.body.ok && mailed.length === 0, 'איפוס למייל בלי משתמש — אותה תשובה, בלי מייל (לא חושפים מי רשום)');
  oobFail = 'iam_http_403';
  res = await call({ op: 'mailSend', kind: 'in', email: 'e@example.com' });
  ok(res.code === 503 && res.body.error === 'mail_off', 'Firebase לא נתן קישור — mail_off (הטלפון שולח דרך Firebase)');
  oobFail = ''; mailOk = false;
  res = await call({ op: 'mailSend', kind: 'in', email: 'f@example.com' });
  ok(res.code === 503 && res.body.error === 'mail_off', 'כל שירותי השליחה נכשלו — mail_off');
  mailOk = true;

  res = await call({ op: 'mailSend', kind: 'verify', idToken: 'ok' });
  ok(res.body.ok && res.body.already, 'אימות למייל שכבר מאומת — לא שולחים');
  mailed = [];
  res = await call({ op: 'mailSend', kind: 'verify', idToken: 'unv' });
  ok(res.body.ok && mailed.length === 1 && mailed[0].to === 'v@example.com', 'אימות — לכתובת מהאסימון, לא מהגוף');
  res = await call({ op: 'mailSend', kind: 'x', email: 'g@example.com' });
  ok(res.code === 400, 'סוג לא מוכר נדחה');
  mailed = [];
  res = await call({ op: 'mailSend', kind: 'in', email: 'h@example.com', path: 'https://evil.example.com/' });
  ok(res.body.ok && mailed[0].html.includes('https://invest.thesnowball.app/?mode=signIn') && !mailed[0].html.includes('evil'), 'נתיב חזרה זר — חוזרים לשורש של האפליקציה');

  /* ---------------------------------------------------------------- 6. השירותים */
  const prov = {
    firestore: { st: 'ok', at: 1000, items: [{ k: 'reads', pct: 75 }, { k: 'writes', pct: 10 }] },
    vercel: { st: 'ok', at: 1000, items: [{ k: 'bw', pct: 5 }, { k: 'inv', pct: 20 }] },
    r2: { st: 'ok', at: 1000, items: [{ k: 'store', pct: 400 }, { k: 'ops', pct: 30 }] },
  };
  const sto = { r2: { at: 1000, b: [{ name: 'snb-studio', gb: 38 }] }, drive: { gb: 14, lim: 15, at: 1000 } };
  const servers = [{ seen: NOW - 60e3, hb: { disk: 50 } }];
  const mail = { list: [{ k: 'brevo', on: true, day: 10, dayMax: 300 }, { k: 'resend', on: false, day: 0, dayMax: 100 }], left: 260 };
  const V = SVC.servicesView({ prov, sto, servers, mail, now: NOW });
  const R = (k) => V.rows.find((x) => x.k === k);
  ok(V.rows.length === SVC.SERVICES.length && V.rows.map((x) => x.k).join() === SVC.KEYS.join(), 'שורה לכל שירות, בסדר הקבוע');
  ok(R('fs').st === 'warn' && R('fs').pct === 75 && R('fs').at === 1e6, 'Firebase: 75% מהקריאות — מעל 70%');
  ok(R('vercel').st === 'ok' && R('vercel').pct === 20, 'Vercel תקין — האחוז הגבוה מבין המדדים');
  ok(R('r2').paid === 1 && R('r2').st === 'ok' && !R('r2').m.some((x) => x.k === 'store'), 'R2 מעל 10GB — בתשלום בידיעה, האחסון לא מתריע; הפעולות כן נספרות');
  ok(R('drive').st === 'crit' && R('drive').pct > 90, 'Drive של הגיבוי כמעט מלא — אדום');
  ok(R('hetzner').st === 'ok' && R('hetzner').pct === 50, 'השרת מדווח, הדיסק 50%');
  ok(R('mail').st === 'ok' && R('mail').left === 260 && R('mail').n === 1, 'מיילים: שירות אחד מוגדר, נשארו 260 היום');
  ok(['pages', 'dns', 'gemini', 'anthropic', 'market', 'hf'].every((k) => R(k).st === 'na'), 'שירות בלי מונה — "אין מונה", לא "תקין"');
  ok(R('dns').bk === 'dns' && R('drive').bk === 'none' && V.sum.risk === 1, 'בלי גיבוי: רק Drive (ל־DNS עותק יומי של הרשומות)');
  const V0 = SVC.servicesView({ now: NOW });
  ok(['fs', 'vercel', 'r2', 'drive', 'mail', 'hetzner'].every((k) => R && V0.rows.find((x) => x.k === k).st === 'off'), 'בלי מדידות — "לא נמדד" (אף מספר לא מומצא)');
  const Vd = SVC.servicesView({ servers: [{ seen: NOW - 30 * 60e3 }], prov: { firestore: { st: 'err', err: 'api_off' } }, mail: { list: [{ k: 'brevo', on: true, day: 270, dayMax: 300 }], left: 0 }, now: NOW });
  const Rd = (k) => Vd.rows.find((x) => x.k === k);
  ok(Rd('hetzner').st === 'down' && Rd('fs').st === 'down' && Rd('mail').st === 'down', 'שרת שותק / תקלה במדידה / אין מקום במיילים — לא עובד');

  /* התראה מ־70%, פעם אחת, עד ירידה מתחת ל־60 */
  let a = SVC.alertsDue(V, {});
  ok(a.fire.sort().join() === 'drive.store,fs.reads', 'מתריעים על כל מדד שעבר 70%');
  a = SVC.alertsDue(V, a.keep);
  ok(a.fire.length === 0 && a.keep['fs.reads'], 'פעם אחת — לא שוב בשעה הבאה');
  const V65 = SVC.servicesView({ prov: { firestore: { st: 'ok', items: [{ k: 'reads', pct: 65 }] } }, now: NOW });
  ok(SVC.alertsDue(V65, a.keep).keep['fs.reads'] === 1, 'ירד ל־65% — עדיין "הותרע" (בלי לנדנד סביב הסף)');
  const V50 = SVC.servicesView({ prov: { firestore: { st: 'ok', items: [{ k: 'reads', pct: 50 }] } }, now: NOW });
  const a50 = SVC.alertsDue(V50, a.keep);
  ok(!a50.keep['fs.reads'] && SVC.alertsDue(V, a50.keep).fire.includes('fs.reads'), 'מתחת ל־60% — מתאפס, ועלייה הבאה מתריעה שוב');
  { const fd = SVC.alertsDue(Vd, {}).fire; ok(fd.includes('mail.down') && !fd.includes('hetzner.down') && !fd.includes('fs.down'), 'נפילה מתריעה רק במיילים (לשרת התראה משלו, תקלה במדידה אינה נפילה)'); }

  /* ---------------------------------------------------------------- 6ב. רשומות הדומיין בגיבוי היומי */
  {
    const DX = require(P('dnsexport.js')), BK = require(P('backup.js')), zlib = require('zlib');
    const BIND = ';; zone\nthesnowball.app.\t1\tIN\tA\t192.0.2.1\ninvest.thesnowball.app.\t1\tIN\tCNAME\tthesnowball.pages.dev.\n';
    ok(DX.looksBind(BIND, 'thesnowball.app') && !DX.looksBind('<html>error</html>', 'thesnowball.app') && !DX.looksBind('', 'thesnowball.app'), 'קובץ BIND תקין מול תשובה אחרת');
    let calls = [];
    const cf = (zoneOk, exp) => async (url, init) => { calls.push(url); if (/\/zones\?name=/.test(url)) return zoneOk ? { status: 200, json: async () => ({ result: [{ id: 'a'.repeat(32) }] }) } : { status: 403, json: async () => ({}) };
      return { status: 200, text: async () => exp }; };
    ok(await DX.dnsExport({}, cf(true, BIND)) === null && calls.length === 0, 'בלי טוקן — לא פונים ל־Cloudflare');
    ok(await DX.dnsExport({ CF_DNS_TOKEN: 't' }, cf(true, BIND)) === BIND && calls[1] === 'https://api.cloudflare.com/client/v4/zones/' + 'a'.repeat(32) + '/dns_records/export', 'עם טוקן — מייצא את הרשומות');
    ok(await DX.dnsExport({ CF_USAGE_TOKEN: 't' }, cf(false, BIND)) === null, 'בלי הרשאה לאזור — null');
    ok(await DX.dnsExport({ CF_DNS_TOKEN: 't' }, cf(true, '<html>')) === null, 'תשובה שאינה BIND — לא נשמרת');
    ok(await DX.dnsExport({ CF_DNS_TOKEN: 't', CF_ZONE: 'bad zone' }, cf(true, BIND)) === null, 'שם אזור לא תקין — לא פונים');
    const store = new Map();
    const io = { listCol: async () => [], head: async (k) => store.has(k), get: async () => null, put: async (k, b) => { store.set(k, b); }, list: async () => [], del: async () => {}, dns: async () => BIND };
    const r1 = await BK.runBackup(io, NOW);
    const dk = BK.bkDnsKey('2026-10-26');
    ok(r1.done && r1.dns && zlib.gunzipSync(store.get(dk)).toString() === BIND, 'הגיבוי היומי כולל את רשומות הדומיין (dns.txt.gz)');
    store.delete(dk);
    const r2 = await BK.runBackup(io, NOW + 60e3);
    ok(!r2.done && r2.dns && store.has(dk), 'גיבוי שכבר נעשה בלי הרשומות (מופע בלי טוקן) — משלימים אותן');
    const r3 = await BK.runBackup(Object.assign({}, io, { dns: async () => null }), NOW + 864e5);
    ok(r3.done && !r3.dns, 'בלי רשומות — הגיבוי של שאר הנתונים לא נפגע');
    ok(BK.bkExpired([dk], NOW + 20 * 864e5).length === 1, 'רשומות הדומיין נמחקות אחרי 14 יום כמו שאר הגיבוי');
  }

  /* ---------------------------------------------------------------- 7. החיבור לשאר המערכת */
  const root = path.join(__dirname, '..');
  const st = fs.readFileSync(path.join(root, 'ibkr-proxy', 'api', 'studio.js'), 'utf8');
  const wp = require(P('webpush.js'));
  ok(wp.KINDS.includes('svc_quota') && wp.TEXT.he.svc_quota && wp.TEXT.en.svc_quota, 'התראה svc_quota בשתי השפות');
  ok(/svc_quota: 'svc'/.test(fs.readFileSync(P('webpush.js'), 'utf8')), 'ההתראה פותחת את עמוד השירותים במרכז הניהול');
  ok(/op === 'adminServices'[\s\S]{0,200}isAdmin\(user\)/.test(st) && /op === 'adminMail'[\s\S]{0,400}isAdmin\(user\)/.test(st), 'adminServices ו־adminMail — מנהל בלבד');
  ok(/svcWatch\(deps, now\)/.test(st) && /'sysWatch', 'svc'/.test(st), 'הבדיקה המתוזמנת מריצה את svcWatch ושומרת ב־sysWatch/svc');
  ok(!/JSON_FIELDS[^\n]*'ks'/.test(fs.readFileSync(P('studio.js'), 'utf8')), 'ks נשמר כמחרוזת — לא שדה JSON (JSON_FIELDS לפי שם בכל האוספים)');
  const adm = fs.readFileSync(path.join(root, 'admin-app.js'), 'utf8');
  ok(/page\('svc'/.test(adm) && /page\('mail'/.test(adm) && /go\('svc'\)/.test(adm) && /go\('mail'\)/.test(adm), 'מרכז הניהול: עמודי שירותים ומיילים ושורות אליהם');
  ok(!/fetch\(/.test(adm.slice(adm.indexOf("page('mail'"), adm.indexOf("page('infra'"))), 'העמודים רק דרך api — בלי fetch ישיר');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const keys = [...new Set((adm.slice(adm.indexOf('const MAIL_NAME'), adm.indexOf("page('infra'")).match(/t\('(adm(?:Mail|Svc)[A-Za-z]*)'\)/g) || []).map((x) => x.slice(3, -2)))];
  const heS = app.slice(app.indexOf('const STRINGS'), app.indexOf('\n  en: {'));
  ok(keys.length > 30 && keys.every((k) => app.split(k + ':').length >= 3), 'כל מחרוזת של העמודים — בעברית ובאנגלית (' + keys.length + ')');
  const acc = fs.readFileSync(path.join(root, 'acclink.js'), 'utf8');
  ok(['accCodeT', 'accCodeShort', 'accCodeBad', 'accCodeOld', 'accCodeAgain', 'accCodeSent2', 'accCodeSub'].every((k) => acc.includes("'" + k + "'") && app.split(k + ':').length >= 3), 'גיליון הקוד — כל המחרוזות בשתי השפות');
  ok(/op: 'mailCode'/.test(acc) && /op: 'mailSend'/.test(acc), 'הטלפון: קודם השרת (mailSend / mailCode)');
  void heS;

  console.log(n + ' בדיקות, ' + bad + ' נכשלו');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
