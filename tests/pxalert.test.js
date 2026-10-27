// 27/10/2026: התראות מחיר ברקע — הספרייה (lib/pxalert.js), השרתון (op:'pxa' + ‏GET ?job=px ב־/api/ibkr-sync),
// ה־Push (webpush 'px'), sw.js (#chart=), הקישור באפליקציה, והבודק בשרת (server.js — startPx). Firestore, Yahoo ו־Push — מדומים.
const fs = require('fs'), path = require('path'), assert = require('assert'), crypto = require('crypto');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const P = require('../ibkr-proxy/lib/pxalert');
const W = require('../ibkr-proxy/lib/webpush');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

/* ---------- הספרייה ---------- */
const al = P.norm([
  { i: 'abcd1234', s: 'aapl', p: 200, b: 190, d: 'up', n: 'שורה\nחדשה' },
  { i: 'abcd1234', s: 'MSFT', p: 1, b: 1 },              // מזהה כפול
  { i: 'x', s: 'MSFT', p: 1, b: 1 },                     // מזהה קצר
  { i: 'zzzz9999', s: 'BAD SYM', p: 1, b: 1 },
  { i: 'yyyy8888', s: 'TEVA.TA', p: -1, b: 1 },
  { i: 'qqqq7777', s: 'BTC-USD', p: 60000, b: 0, d: 'weird' },
]);
ok(al.length === 2 && al[0].s === 'AAPL' && al[0].n === 'שורה חדשה' && al[1].d === 'cross', 'norm: רק תקינים, סימבול באותיות גדולות, כיוון לא מוכר = חצייה');
ok(P.norm(Array.from({ length: 150 }, (_, i) => ({ i: 'id' + String(i).padStart(4, '0'), s: 'A', p: 1, b: 1 }))).length === P.MAX, 'norm: עד MAX');
ok(JSON.stringify(P.pruneFired({ abcd1234: 5, gone0000: 6 }, al)) === '{"abcd1234":5}', 'pruneFired: רק התראות שעוד קיימות');
ok(P.priceOf({ state: 'REGULAR', reg: { p: 10 }, post: { p: 11 } }) === 10 && P.priceOf({ state: 'POST', reg: { p: 10 }, post: { p: 11 } }) === 11
  && P.priceOf({ state: 'PRE', reg: { p: 10 } }) === 10 && P.priceOf({ state: 'CLOSED', reg: { p: 10 }, night: { p: 9 } }) === 9 && P.priceOf(null) === 0, 'priceOf: כמו הגרף (רגיל / טרום / אחרי / לילה)');
const A = (d, p) => ({ d, p });
ok(P.crossed(A('up', 100), 99, 100) && !P.crossed(A('up', 100), 101, 99) && P.crossed(A('down', 100), 101, 100) && P.crossed(A('cross', 100), 101, 99) && !P.crossed(A('cross', 100), 0, 101), 'crossed: חצייה כמו בגרף');
{
  const last = new Map();
  const users = [{ uid: 'u1aaaaaa', a: [{ i: 'up000001', s: 'AAPL', p: 200, b: 190, d: 'up' }, { i: 'dn000001', s: 'AAPL', p: 180, b: 190, d: 'down' }], f: {} }];
  ok(P.check(users, { AAPL: 195 }, last).length === 0, 'check: בלי חצייה — כלום');
  const r = P.check(users, { AAPL: 201 }, last);
  ok(r.length === 1 && r[0].hits.length === 1 && r[0].hits[0].a.i === 'up000001', 'check: חצייה למעלה — רק ההתראה הנכונה');
  users[0].f = { up000001: 1 };
  ok(P.check(users, { AAPL: 179 }, last)[0].hits.map((h) => h.a.i).join() === 'dn000001', 'check: מה שנשלח לא נשלח שוב; ירידה נתפסת מהמחיר הקודם שנראה');
  // התראת "למעלה" כשהמחיר כבר מעל: קודם יורד מתחת, ואז נשלחת בחצייה — המחיר הקודם נשמר גם כשהרשימה נטענת מחדש
  const u2 = [{ uid: 'u2bbbbbb', a: [{ i: 'up000002', s: 'X', p: 10, b: 12, d: 'up' }], f: {} }];
  ok(!P.check(u2, { X: 11 }, last).length && !P.check(u2, { X: 9 }, last).length && P.check(JSON.parse(JSON.stringify(u2)), { X: 10.5 }, last).length === 1, 'check: מחיר קודם לפי התראה, לא מתאפס בטעינה מחדש');
}
{
  const m = P.text({ i: 'abcd1234', s: 'AAPL', p: 200, d: 'up', n: 'יעד' }, 201.5, 'he'), e = P.text({ i: 'abcd1234', s: 'AAPL', p: 200, d: 'down', n: '' }, 199, 'en');
  ok(m.t === '🔔 AAPL' && /עלה מעל 200\.00/.test(m.b) && /201\.50/.test(m.b) && /יעד/.test(m.b) && m.u === '#chart=AAPL', 'text: עברית — מה קרה, המחיר עכשיו, ההערה, ופתיחה בגרף');
  ok(/^fell below 200\.00 · now 199\.00$/.test(e.b), 'text: אנגלית');
  const wm = W.message('px', '', 'en', { a: { i: 'abcd1234', s: 'AAPL', p: 200, d: 'up', n: '' }, p: 201 });
  ok(wm && wm.k === 'px' && wm.u === '#chart=AAPL' && wm.i === 'abcd1234' && /rose above/.test(wm.b) && W.message('px', '', 'he', null) === null, 'webpush: סוג px — הטקסט מההתראה, בשפת המכשיר');
}

/* ---------- sw.js והאפליקציה ---------- */
const sw = R('sw.js'), app = R('app.js'), ch = R('chart.js');
ok(/m\.k === 'px' \? \/\^#chart=/.test(sw) && /'px-' \+/.test(sw), 'sw.js: התראת מחיר נפתחת ב־#chart= עם תג לכל התראה');
ok(/get\('chart'\)/.test(app) && /openChartFor\(ch\)/.test(app) && /tab\|stock\|studio\|chart\)=/.test(app), 'app.js: הקישור #chart= פותח את הגרף (גם מהרקע)');
ok(/sync: \(b\) => ibkrBgApi\(b\)/.test(app), 'app.js: הגרף מסנכרן דרך /api/ibkr-sync עם טוקן ההתחברות');
ok(/op: 'pxa', act: 'sync'/.test(ch) && /pushManager\.subscribe/.test(ch) && /BG\.st === 'on'\) return/.test(ch), 'chart.js: סנכרון + מנוי Push; בלי התראת מערכת כפולה כשהרקע פעיל');
for (const k of ['kcBgOn', 'kcBgOff', 'kcBgEnable', 'kcBgAuth', 'kcBgDeny', 'kcBgNo']) ok((app.match(new RegExp('\\b' + k + ": '", 'g')) || []).length === 2, k + ' בשתי השפות');

/* ---------- השרת: הבודק רץ כל 30 שנ׳, גם כש־SNB_CRON כבוי ---------- */
{
  const srv = R('ibkr-proxy/server.js');
  ok(/if \(process\.env\.SNB_PXA !== 'off'\) startPx\(server\)/.test(srv) && /job=px/.test(srv) && /30e3/.test(srv), 'server.js: startPx כל 30 שנ׳');
  ok(!/job=px/.test(R('ibkr-proxy/vercel.json')), 'vercel.json: בלי קרון לדקות (Hobby דוחה)');
}

/* ---------- השרתון מקצה לקצה (מדומה) ---------- */
(async () => {
  const gauth = require('../ibkr-proxy/lib/gauth');
  ['IBKR_VAULT_KEY', 'IBKR_SYNC_USERS', 'CRON_SECRET'].forEach((k) => delete process.env[k]);
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.GDRIVE_SA_KEY = JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  gauth._reset();
  const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tnow = Math.floor(Date.now() / 1000);
  const tok = (sub, email) => { const hd = b64({ alg: 'RS256', kid: 'k1' }), bd = b64({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub, iat: tnow - 5, exp: tnow + 3000, email, email_verified: true }); return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url'); };
  const USER = tok('pxUser000001', 'someone@example.com');
  const store = new Map(), pushes = [];
  const J = (o, st = 200) => ({ status: st, json: async () => o });
  const fakeFetch = async (url, opt = {}) => {
    if (url.includes('oauth2.googleapis.com/token')) return J({ access_token: 'AT', expires_in: 3600 });
    if (url.startsWith('https://fcm.googleapis.com/')) { pushes.push({ url, h: opt.headers }); return { status: 201, json: async () => ({}) }; }
    const m = url.match(/documents\/(pxAlerts|studioVault)(?:\/([A-Za-z0-9_]+))?(?:\?(.*))?$/); if (!m) return J({}, 404);
    const [, col, id, qs = ''] = m, q = new URLSearchParams(qs), key = col + '/' + id;
    if (!id) return J({ documents: [...store.entries()].filter(([k]) => k.startsWith(col + '/')).map(([k, v]) => ({ name: 'projects/p/databases/(default)/documents/' + k, fields: v })) });
    const cur = store.get(key);
    if (opt.method === 'GET') return cur ? J({ fields: cur }) : J({}, 404);
    if (opt.method === 'PATCH') {
      if (q.get('currentDocument.exists') === 'false' && cur) return J({}, 409);
      const mask = q.getAll('updateMask.fieldPaths'), body = JSON.parse(opt.body).fields;
      store.set(key, Object.assign({}, cur || {}, ...mask.map((k) => ({ [k]: body[k] })))); return J({});
    }
    return J({}, 400);
  };
  const quotes = { _fetchExt: async (syms) => Object.fromEntries(syms.map((s) => [s, { state: 'REGULAR', reg: { p: PRICE[s] || 0 } }])) };
  const PRICE = { AAPL: 195 };
  const sync = require('../ibkr-proxy/api/ibkr-sync');
  const deps = { verify: { keys }, fetch: fakeFetch, quotes };
  const res = () => { const r = { statusCode: 200, payload: null }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (o) => { r.payload = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };
  const post = async (body) => { const r = res(); await sync._handler({ method: 'POST', query: {}, body, headers: { origin: 'https://invest.thesnowball.app' }, socket: { remoteAddress: '9.9.9.9' } }, r, deps); return r; };
  const cron = async (headers = {}) => { const r = res(); await sync._handler({ method: 'GET', query: { job: 'px' }, headers, socket: {} }, r, deps); return r; };
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };

  ok((await post({ op: 'pxa', act: 'key' })).statusCode === 401, 'pxa: בלי התחברות — 401');
  const k = await post({ op: 'pxa', act: 'key', idToken: USER });
  ok(k.payload.ok && /^[A-Za-z0-9_-]{87}$/.test(k.payload.key) && store.has('studioVault/_vapid'), 'pxa key: מפתח ציבורי (נוצר פעם אחת בכספת) — גם למי שלא מורשה לסנכרון IBKR');
  const s1 = await post({ op: 'pxa', act: 'sync', idToken: USER, lang: 'he', sub, alerts: [{ i: 'up000001', s: 'AAPL', p: 200, b: 195, d: 'up', n: 'יעד' }] });
  ok(s1.payload.ok && s1.payload.n === 1 && JSON.stringify(s1.payload.fired) === '{}', 'pxa sync: נשמר, מנוי אחד');
  const doc = store.get('pxAlerts/pxUser000001');
  ok(doc && /AAPL/.test(doc.a.stringValue) && !/idToken/.test(JSON.stringify(doc)), 'Firestore: pxAlerts/{uid} — ההתראות והמנוי, בלי טוקן');
  let c = await cron();
  ok(c.payload.ok && c.payload.syms === 1 && !c.payload.fired && pushes.length === 0, 'בודק: מחיר מתחת לרמה — בלי Push');
  PRICE.AAPL = 201;
  c = await cron();
  ok(c.payload.fired === 1 && c.payload.sent === 1 && pushes.length === 1 && pushes[0].h.TTL === '3600' && /^vapid /.test(pushes[0].h.Authorization), 'בודק: חצייה → Push אחד (VAPID, ‏TTL שעה)');
  c = await cron();
  ok(!c.payload.fired && pushes.length === 1, 'בודק: לא שולח שוב את אותה התראה');
  const s2 = await post({ op: 'pxa', act: 'sync', idToken: USER, alerts: [{ i: 'up000001', s: 'AAPL', p: 200, b: 195, d: 'up' }] });
  ok(s2.payload.fired && s2.payload.fired.up000001 > 0, 'pxa sync: הטלפון מקבל מה שנשלח ברקע (מסמן "הופעלה")');
  await post({ op: 'pxa', act: 'sync', idToken: USER, alerts: [] });
  ok(JSON.parse(store.get('pxAlerts/pxUser000001').f.stringValue).up000001 === undefined, 'התראה שנמחקה בטלפון — נמחקת גם מהרשומה');
  process.env.CRON_SECRET = 'sec';
  ok((await cron()).statusCode === 401 && (await cron({ authorization: 'Bearer sec' })).statusCode === 200, 'בודק: עם CRON_SECRET — רק עם הסוד');
  delete process.env.CRON_SECRET;
  const off = await post({ op: 'pxa', act: 'off', idToken: USER, e: sub.endpoint });
  ok(off.payload.ok && off.payload.n === 0, 'pxa off: המכשיר יצא');
  ok((await post({ op: 'pxa', act: 'nope', idToken: USER })).statusCode === 400, 'pxa: פעולה לא מוכרת — 400');
  console.log('pxalert: ' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
