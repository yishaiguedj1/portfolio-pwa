/* IB Gateway — שלב 1 במחקר המסחר (28/10/2026): Paper, ‏Read-Only. הגשר (lib/ibgw.js), הפעולה op:'gwLive' (SERVER_ONLY),
   ההתראה כשהסשן נפל, השורה במגדל, הכרטיס בטלפון והתשתית (compose.ibgw.yaml).
   הכל מול mock של TWS API — שרת TCP מקומי שמדבר את הפרוטוקול עם נתונים סינתטיים. אף פעם לא Gateway אמיתי.
   הרצה: node tests/ibgw.test.js */
'use strict';
const fs = require('fs');
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const R = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('ok - ' + m); } else { fail++; console.log('not ok - ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 3000) => { const end = Date.now() + ms; while (Date.now() < end) { if (f()) return true; await sleep(10); } return false; };

const G = require('../ibkr-proxy/lib/ibgw');

/* ---------- מסגרות ---------- */
{
  const f = G.frame([61, 1, 'x']);
  ok(f.readUInt32BE(0) === 7 && f.slice(4).toString() === '61\u00001\u0000x\u0000', 'frame: אורך + שדות שנגמרים ב־\\0');
  const two = Buffer.concat([G.frame(['9', '1', '5']), G.frame(['15', '1', 'A'])]);
  const u = G.unframe(Buffer.concat([two, two.slice(0, 6)]));
  ok(u.msgs.length === 2 && u.msgs[0].join() === '9,1,5' && u.msgs[1].join() === '15,1,A' && u.rest.length === 6, 'unframe: שתי הודעות, והחלקית נשארת');
  const bad = Buffer.alloc(4); bad.writeUInt32BE(0x7fffffff);
  ok(G.unframe(bad) === null, 'unframe: אורך לא סביר = זרם שבור');
  const h = G.hello();
  ok(h.slice(0, 4).toString('latin1') === 'API\u0000' && h.slice(8).toString() === 'v100..176', 'hello: ‏API\\0 + v100..176 (גרסה מקסימלית נעולה — צורת ההודעות קבועה)');
}

/* ---------- mock של TWS API ---------- */
function mockTws(opts = {}) {
  const st = { conns: 0, got: [], sockets: [] };
  const server = net.createServer((s) => {
    st.conns++; st.sockets.push(s);
    if (opts.closeAtOnce) return s.destroy();     // כמו socat כשה־Gateway עוד לא נכנס (2FA)
    let buf = Buffer.alloc(0), hs = false;
    const out = (fields) => s.write(G.frame(fields));
    s.on('data', (c) => {
      buf = Buffer.concat([buf, c]);
      if (!hs) {
        if (buf.length < 8) return;
        const n = buf.readUInt32BE(4);
        if (buf.length < 8 + n) return;
        st.hello = buf.slice(0, 8 + n).toString('latin1');
        buf = buf.slice(8 + n); hs = true;
        if (opts.silent) return;
        out(['176', '20261028 10:00:00 America/New_York']);
      }
      const u = G.unframe(buf); buf = u.rest;
      for (const f of u.msgs) {
        st.got.push(f.join(','));
        const id = +f[0];
        if (id === 71) { out(['9', '1', '1']); out(['15', '1', 'DUTEST1']); }
        if (id === 61) {
          // אחזקות סינתטיות: AAPL ‏10 @ 150, ‏MSFT 5 @ 300, ואחת שנסגרה (0) — לא מוצגת
          out(['61', '3', 'DUTEST1', '265598', 'AAPL', 'STK', '', '0', '', '', 'NASDAQ', 'USD', 'AAPL', 'NMS', '10', '150.25']);
          out(['61', '3', 'DUTEST1', '272093', 'MSFT', 'STK', '', '0', '', '', 'NASDAQ', 'USD', 'MSFT', 'NMS', '5', '300']);
          out(['61', '3', 'DUTEST1', '1', 'OLD', 'STK', '', '0', '', '', 'NASDAQ', 'USD', 'OLD', 'NMS', '0', '1']);
          out(['62', '1']);
        }
        if (id === 62) {
          out(['63', '1', f[2], 'DUTEST1', 'NetLiquidation', '100000.5', 'USD']);
          out(['63', '1', f[2], 'DUTEST1', 'TotalCashValue', '25000', 'USD']);
          out(['63', '1', f[2], 'DUTEST1', 'BuyingPower', '1.7976931348623157E308', 'USD']);
          out(['64', '1', f[2]]);
        }
        if (id === 16) {
          // פקודה פתוחה סינתטית: קנייה 3 AAPL בלימיט 140, ועוד אחת שבוצעה (Filled) — לא מוצגת
          out(['5', '11', '265598', 'AAPL', 'STK', '', '0', '?', '', 'SMART', 'USD', 'AAPL', 'NMS', 'BUY', '3', 'LMT', '140', '0', 'GTC', '', 'DUTEST1', 'O', '0', '', '0', '0', 'more', 'fields']);
          out(['3', '11', 'Submitted', '0', '3', '0', '123', '0', '0', '0', '', '0']);
          out(['5', '12', '272093', 'MSFT', 'STK', '', '0', '?', '', 'SMART', 'USD', 'MSFT', 'NMS', 'SELL', '1', 'MKT', '0', '0', 'DAY', '', 'DUTEST1']);
          out(['3', '12', 'Filled', '1', '0', '301', '124', '0', '301', '0', '', '0']);
          out(['53', '1']);
        }
      }
    });
    s.on('error', () => {});
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, st, port: server.address().port,
    push: (fields) => st.sockets.forEach((s) => !s.destroyed && s.write(G.frame(fields))),
    close: () => new Promise((rr) => { st.sockets.forEach((s) => s.destroy()); server.close(() => rr()); }) })));
}

(async () => {
  /* ---------- הגשר מול ה־mock ---------- */
  {
    G._reset();
    ok(G.tick({ env: {} }) === 'off' && G.stateView().st === 'off', 'בלי IBGW_HOST — off, בלי חיבור');
    const m = await mockTws();
    const env = { IBGW_HOST: '127.0.0.1', IBGW_PORT: String(m.port) };
    G.tick({ env });
    ok(await until(() => G._state().st === 'connected'), 'handshake → startApi → nextValidId = connected');
    ok(m.st.hello === 'API\u0000\u0000\u0000\u0000\u0009v100..176', 'נשלח hello תקין');
    ok(m.st.got.some((x) => x === '71,2,7,'), 'startApi עם clientId 7 (ברירת מחדל)');
    ok(m.st.got.includes('61,1') && m.st.got.some((x) => x.startsWith('62,1,9001,All,NetLiquidation')) && m.st.got.includes('16,1'), 'ביקש: אחזקות, יתרות, כל הפקודות הפתוחות');
    await until(() => G._state().ordAt > 0 && G._state().sumAt > 0 && G._state().posAt > 0);
    const v = await G.live({ wait: 500 });
    ok(v.st === 'connected' && v.mode === 'paper' && v.ro === true, 'live: מצב, Paper, קריאה בלבד');
    ok(v.pos.length === 2 && v.pos[0].s === 'AAPL' && v.pos[0].q === 10 && v.pos[0].avg === 150.25 && v.pos[1].s === 'MSFT', 'live: אחזקות (אחזקה של 0 לא מוצגת)');
    const net1 = v.sum.find((x) => x.k === 'NetLiquidation');
    ok(net1 && net1.v === 100000.5 && net1.c === 'USD' && !v.sum.some((x) => x.k === 'BuyingPower'), 'live: יתרות; הערך "לא הוגדר" של IBKR (1.79E308) לא מוצג');
    ok(v.ord.length === 1 && v.ord[0].s === 'AAPL' && v.ord[0].side === 'BUY' && v.ord[0].q === 3 && v.ord[0].type === 'LMT' && v.ord[0].lmt === 140 && v.ord[0].tif === 'GTC' && v.ord[0].st === 'Submitted', 'live: פקודה פתוחה (שבוצעה — לא מוצגת)');
    ok(!JSON.stringify(v).includes('DUTEST1'), 'live: בלי מספר החשבון');
    // נתק בין ה־Gateway ל־IBKR
    m.push(['4', '2', '-1', '1100', 'Connectivity between IB and TWS has been lost']);
    ok(await until(() => G._state().st === 'down'), 'קוד 1100 — down');
    const vd = await G.live({});
    ok(vd.st === 'down' && !vd.pos && !vd.ord, 'במצב down — בלי נתונים (אף פעם לא תמונה ישנה כאילו חיה)');
    m.push(['4', '2', '-1', '1102', 'Connectivity between IB and TWS has been restored']);
    ok(await until(() => G._state().st === 'connected'), 'קוד 1102 — חזר ל־connected');
    // ה־Gateway נסגר (הפעלה מחדש)
    await m.close();
    ok(await until(() => G._state().st === 'down'), 'החיבור נסגר — down, ונתוני הזיכרון נמחקים');
    ok(G._state().pos.size === 0 && G._state().orders.size === 0, 'הזיכרון התרוקן');
    // התראה: פעם אחת, אחרי 2 דק׳ רצופות
    const t0 = G._state().downAt;
    ok(G.alertDue(t0 + 60e3) === '', 'דקה אחרי הנפילה — עוד בלי התראה (הפעלה מחדש של הלילה)');
    ok(G.alertDue(t0 + 121e3) === 'down', 'אחרי 2 דק׳ — התראה');
    ok(G.alertDue(t0 + 300e3) === '', 'רק פעם אחת לכל נפילה');
    G._reset();
  }
  {
    // הקונטיינר עונה (socat) אבל סוגר מיד — ה־Gateway עוד לא נכנס = needs2FA
    const m = await mockTws({ closeAtOnce: true });
    G.tick({ env: { IBGW_HOST: '127.0.0.1', IBGW_PORT: String(m.port) } });
    ok(await until(() => G._state().st === 'needs2FA'), 'נסגר לפני ה־handshake — needs2FA');
    ok(G.svcView().st === 'warn' && G.svcView().gw === 'needs2FA', 'המגדל: warn + needs2FA');
    const boot = G._state().boot;
    ok(G.alertDue(G._state().downAt + 200e3) === '' || boot + 600e3 > G._state().downAt + 200e3, 'אחרי עלייה, בלי חיבור קודם — לא מתריעים לפני 10 דק׳');
    ok(G.alertDue(boot + 601e3) === 'needs2FA', '…ואחרי 10 דק׳ כן');
    await m.close();
    G._reset();
  }
  {
    // אין אף אחד בפורט — down
    const m = await mockTws(); const port = m.port; await m.close();
    G.tick({ env: { IBGW_HOST: '127.0.0.1', IBGW_PORT: String(port) } });
    ok(await until(() => G._state().st === 'down'), 'חיבור נדחה — down');
    ok(G.svcView().st === 'down', 'המגדל: down');
    const n = G._state().nextTry;
    ok(G.tick({ env: { IBGW_HOST: '127.0.0.1', IBGW_PORT: String(port) } }) === 'down' && G._state().sock === null && n > Date.now(), 'ניסיון חוזר רק אחרי המתנה (backoff)');
    G._reset();
  }
  {
    // לא עונה ל־hello — אחרי 8 שנ׳ נסגר (כאן: בודקים רק שיש טיימר, בלי לחכות)
    const src = R('ibkr-proxy/lib/ibgw.js');
    ok(/HS: 8e3/.test(src) && /hsTimer = setTimeout/.test(src), 'handshake שלא נענה — נסגר אחרי 8 שנ׳');
    ok(!/console\.(log|error)\([^)]*(pos|sum|orders|acct|f\[)/.test(src) && /console\.log\('\[ibgw\]', st\)/.test(src), 'בלוג — רק המצב, אף נתון של החשבון');
    ok(!/require\('(?!net'|\.)/.test(src), 'בלי תלויות (רק net של Node)');
    ok(!/firestore\.googleapis|fs\(deps|datastoreToken/.test(src), 'המצב החי בזיכרון בלבד — בלי Firestore');
  }

  /* ---------- appscope, המגדל, ההתראה ---------- */
  {
    const A = require('../ibkr-proxy/lib/appscope');
    ok(JSON.stringify(A.scopeFor('ibkr-sync', 'gwLive')) === '["invest"]' && A.SCOPE['ibkr-sync:gwLive'], 'appscope: שורה מפורשת ל־gwLive — רק Invest');
    const req = { url: '/api/ibkr-sync', headers: { origin: 'https://studio.thesnowball.app' } };
    ok(A.appDenied(req, { op: 'gwLive' }, {}) === 'wrong_app', 'gwLive מ־Studio — נחסם');
    const S = require('../ibkr-proxy/lib/services');
    const row = (f) => S.servicesView(Object.assign({ now: 1e12 }, f)).rows.find((r) => r.k === 'ibkr');
    ok(row({}).st === 'off' && row({}).bk === 'flex', 'המגדל: בלי Gateway — off, הגיבוי Flex');
    ok(row({ ibgw: { st: 'warn', gw: 'needs2FA', at: 5 } }).gw === 'needs2FA' && row({ ibgw: { st: 'down', gw: 'down' } }).st === 'down', 'המגדל: needs2FA / down');
    ok(/ibgw: require\('\.\.\/lib\/ibgw'\)\.svcView\(\)/.test(R('ibkr-proxy/api/studio.js')), 'svcFacts מעביר את מצב ה־Gateway');
    const adm = R('admin-app.js');
    ok(/ibkr: \(\) => t\('admSvcNIbkr'\)/.test(adm) && /flex: \(\) => t\('admSvcBkIbkr'\)/.test(adm) && /r\.gw === 'needs2FA' \? t\('admSvcGw2fa'\)/.test(adm), 'מרכז הניהול: שם, גיבוי, "ממתין לכניסה"');
    const W = require('../ibkr-proxy/lib/webpush');
    const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
    const sub = W.normSub({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') }, l: 'he' });
    let sent = null;
    const v = W.genVapid();
    const r = await W.sendAll({ fetch: async (u, o) => { sent = o; return { status: 201 }; } }, v, [sub], 'ibgw', '', Date.now(), { st: 'needs2FA' });
    ok(r.sent === 1 && sent && sent.headers.Urgency === 'high', 'התראת ibgw נשלחת (דחופה)');
    const src = R('ibkr-proxy/lib/webpush.js');
    ok(/kind === 'ibgw'/.test(src) && /u: '#tab=settings'/.test(src) && /לאשר את ה־2FA/.test(src), 'התוכן: נפתח בהגדרות, 2FA / לא עונה');
    const sw = R('sw.js');
    ok(/m\.k === 'ibgw' && m\.u === '#tab=settings'/.test(sw) && /gw \? 'ibgw'/.test(sw), 'sw.js: נפתח בהגדרות, תג אחד שמתחלף');
  }

  /* ---------- השרתון מקצה לקצה: gwLive + הבודק ---------- */
  {
    const gauth = require('../ibkr-proxy/lib/gauth');
    ['IBKR_VAULT_KEY', 'CRON_SECRET', 'VERCEL', 'IBGW_OWNER'].forEach((k) => delete process.env[k]);
    process.env.IBKR_SYNC_USERS = 'owner@example.com';
    const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.GDRIVE_SA_KEY = JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) });
    gauth._reset();
    const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const tnow = Math.floor(Date.now() / 1000);
    const tok = (sub, email) => { const hd = b64({ alg: 'RS256', kid: 'k1' }), bd = b64({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub, iat: tnow - 5, exp: tnow + 3000, email, email_verified: true }); return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url'); };
    const OWNER = tok('gwOwner00001', 'owner@example.com'), OTHER = tok('gwOther00001', 'other@example.com');
    const store = new Map(), pushes = [];
    const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
    store.set('pxAlerts/gwOwner00001', { w: { stringValue: JSON.stringify([{ e: 'https://fcm.googleapis.com/fcm/send/own', p: ecdh.getPublicKey().toString('base64url'), a: crypto.randomBytes(16).toString('base64url'), l: 'he', at: 1 }]) }, a: { stringValue: '[]' }, f: { stringValue: '{}' }, l: { stringValue: 'he' } });
    const J = (o, st = 200) => ({ status: st, json: async () => o });
    const fakeFetch = async (url, opt = {}) => {
      if (url.includes('oauth2.googleapis.com/token')) return J({ access_token: 'AT', expires_in: 3600 });
      if (url.startsWith('https://fcm.googleapis.com/')) { pushes.push(url); return { status: 201, json: async () => ({}) }; }
      const m = url.match(/documents\/(pxAlerts|studioVault)(?:\/([A-Za-z0-9_]+))?(?:\?(.*))?$/); if (!m) return J({}, 404);
      const [, col, id, qs = ''] = m, q = new URLSearchParams(qs), key = col + '/' + id;
      if (!id) return J({ documents: [...store.entries()].filter(([k]) => k.startsWith(col + '/')).map(([k, v]) => ({ name: 'p/' + k, fields: v })) });
      const cur = store.get(key);
      if (opt.method === 'GET') return cur ? J({ fields: cur }) : J({}, 404);
      if (opt.method === 'PATCH') {
        if (q.get('currentDocument.exists') === 'false' && cur) return J({}, 409);
        const mask = q.getAll('updateMask.fieldPaths'), body = JSON.parse(opt.body).fields;
        store.set(key, Object.assign({}, cur || {}, ...mask.map((k) => ({ [k]: body[k] })))); return J({});
      }
      return J({}, 400);
    };
    const sync = require('../ibkr-proxy/api/ibkr-sync');
    ok(sync.SERVER_ONLY_OPS.has('gwLive'), 'gwLive מסומן SERVER_ONLY');
    const m = await mockTws();
    let fake = 0;
    const deps = { verify: { keys }, fetch: fakeFetch, quotes: { _fetchExt: async () => ({}) }, env: { IBGW_HOST: '127.0.0.1', IBGW_PORT: String(m.port) }, wait: 1500, now: () => fake || Date.now() };
    const res = () => { const r = { statusCode: 200, payload: null }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (o) => { r.payload = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };
    const post = async (body, d = deps) => { const r = res(); await sync._handler({ method: 'POST', query: {}, body, headers: { origin: 'https://invest.thesnowball.app' }, socket: { remoteAddress: '9.9.9.9' } }, r, d); return r; };
    const cron = async () => { const r = res(); await sync._handler({ method: 'GET', query: { job: 'px' }, headers: {}, socket: {} }, r, deps); return r; };
    G._reset();
    process.env.VERCEL = '1';
    let r = await post({ op: 'gwLive', idToken: OWNER });
    ok(r.statusCode === 421 && r.payload.error === 'gw_remote', 'ב־Vercel — 421 (הטלפון נשאר עם Flex)');
    delete process.env.VERCEL;
    r = await post({ op: 'gwLive', idToken: OTHER });
    ok(r.statusCode === 403, 'משתמש לא מורשה — 403');
    r = await post({ op: 'gwLive' });
    ok(r.statusCode === 401, 'בלי התחברות — 401');
    r = await post({ op: 'gwLive', idToken: OWNER }, Object.assign({}, deps, { env: {} }));
    ok(r.statusCode === 200 && r.payload.gw.st === 'off', 'בלי IBGW_HOST — off');
    r = await post({ op: 'gwLive', idToken: OWNER });
    await until(() => G._state().st === 'connected' && G._state().ordAt > 0 && G._state().sumAt > 0);
    r = await post({ op: 'gwLive', idToken: OWNER });
    ok(r.statusCode === 200 && r.payload.gw.st === 'connected' && r.payload.gw.pos.length === 2 && r.payload.gw.ord.length === 1, 'gwLive: מחובר — אחזקות ופקודות חיות');
    ok(!JSON.stringify(r.payload).includes('DUTEST1'), 'gwLive: בלי מספר החשבון');
    // הסשן נופל → הבודק (כל 5 שנ׳) שולח התראה פעם אחת, אחרי 2 דק׳, לבעלים (מי שהסתכל — gwOwner)
    await m.close();
    await until(() => G._state().st === 'down');
    let c = await cron();
    ok(c.payload.ok && !c.payload.gw && pushes.length === 0, 'הבודק: מיד אחרי הנפילה — בלי התראה');
    fake = Date.now() + 130e3;
    c = await cron();
    ok(c.payload.gw === 1 && pushes.length === 1 && pushes[0].endsWith('/own'), 'הבודק: אחרי 2 דק׳ — התראה אחת לטלפון של הבעלים');
    c = await cron();
    ok(!c.payload.gw && pushes.length === 1, 'לא שולח שוב על אותה נפילה');
    G._reset();
    delete process.env.IBKR_SYNC_USERS;
  }

  /* ---------- הטלפון: הכרטיס ---------- */
  {
    const app = R('app.js');
    const a = app.indexOf('function ibkrLiveHTML(g)'), b = app.indexOf('function ibkrLivePaint()');
    const ctx = { t: (k) => k, esc: (s) => String(s).replace(/</g, '&lt;'), fmtTradeMoney: (v, c) => c + ' ' + v };
    vm.runInNewContext(app.slice(a, b) + ';this.H = ibkrLiveHTML;', ctx);
    ok(ctx.H(null) === '', 'כרטיס: בלי Gateway — כלום');
    const w = ctx.H({ st: 'needs2FA' });
    ok(/ibgw2fa/.test(w) && /ibgw2faHint/.test(w) && !/ibgwPos/.test(w), 'כרטיס: ממתין לכניסה + הסבר, בלי נתונים');
    const h = ctx.H({ st: 'connected', sum: [{ k: 'NetLiquidation', c: 'USD', v: 100 }], pos: [{ s: 'AAPL', q: 10, avg: 150, c: 'USD' }], ord: [{ id: 1, s: 'AAPL<x>', side: 'BUY', q: 3, type: 'LMT', lmt: 140, c: 'USD' }] });
    ok(/ibgwOk/.test(h) && /USD 100/.test(h) && /10 @ USD 150/.test(h) && /ibgwBuy 3 LMT @ USD 140/.test(h) && /ibgwRo/.test(h), 'כרטיס: מחובר — שווי, אחזקות, פקודות, "קריאה בלבד"');
    ok(!/AAPL<x>/.test(h), 'כרטיס: escape לכל ערך');
    const sec = app.slice(app.indexOf('const IBGW_LIVE = '), b + 400);
    ok(/op: 'gwLive'/.test(sec) && !/localStorage/.test(sec), 'כרטיס: מ־op:gwLive, בזיכרון בלבד (לא localStorage)');
    ok(/ibkrLivePaint\(\);\n  ibkrLiveLoad\(false\);/.test(app), 'renderIbkrCard מצייר וטוען (כל 30 שנ׳ לכל היותר)');
    ok(/id="ibkrLive" class="ib-live hidden"/.test(R('index.html')), 'index.html: מקום לחיבור החי (מוסתר עד שיש)');
  }

  /* ---------- התשתית ---------- */
  {
    const y = R('infra/compose.ibgw.yaml');
    ok(/image: ghcr\.io\/gnzsnz\/ib-gateway:stable@sha256:[0-9a-f]{64}\n/.test(y), 'התמונה נעולה ב־digest');
    ok(/TRADING_MODE=paper/.test(y) && /READ_ONLY_API=yes/.test(y) && !/TRADING_MODE=live/.test(y), 'Paper + Read-Only');
    ok(!/^\s*ports:/m.test(y) && !/^\s*- VNC_SERVER_PASSWORD/m.test(y), 'בלי ports, בלי VNC');
    ok(/ibgw:\n    internal: true/.test(y) && /networks: \[ibgw, ibgw-out\]/.test(y) && /networks: \[edge-prod, ibgw\]/.test(y), 'רשת פנימית רק app ↔ ibgw; היציאה של ה־Gateway ברשת משלו');
    ok(/cap_drop: \[ALL\]/.test(y) && /no-new-privileges:true/.test(y) && /mem_limit: 1280m/.test(y) && /healthcheck:/.test(y), 'בלי הרשאות, תקרת זיכרון, healthcheck');
    ok(/\/etc\/snb\/ibgw\.env/.test(y) && !/TWS_PASSWORD=/.test(y), 'הסיסמה רק מקובץ ה־env בשרת');
    ok(/IBGW_HOST=ibgw/.test(y) && /IBGW_PORT=4004/.test(y), 'חדר האפליקציה מקבל את הכתובת של ה־Gateway');
    const sh = R('infra/host/snb-common.sh');
    ok(/\[ -s \/etc\/snb\/ibgw\.env \] && \[ -s "\$SNB_DIR\/compose\.ibgw\.yaml" \] && r="\$r,ibgw"/.test(sh), 'snb-common: החדר ibgw רק כשיש סיסמה וקובץ');
    ok(/\$\{f2:\+-f "\$f2"\}/.test(sh) && /\*,ibgw,\*\) m=\$\(\(m - 1300\)\)/.test(sh), 'snb_compose מוסיף את הקובץ רק אז; הזיכרון של העובד קטן בהתאם');
    ok(R('infra/cloud-init.yaml').includes('/opt/snb/compose.ibgw.yaml'), 'cloud-init: הקובץ מותקן בשרת חדש');
    const P = require('../tools/server-provision.js');
    const errs = [];
    ok(P.ibgwFile({}, errs) === null && !errs.length, 'הקמה: בלי סודות IBGW — בלי חדר');
    const f = P.ibgwFile({ IBGW_PAPER_USER: 'paperusr1', IBGW_PAPER_PASS: 'Abc!def%123' }, errs);
    ok(f && f.path === '/etc/snb/ibgw.env' && f.lines[0] === 'TWS_USERID=paperusr1' && !errs.length, 'הקמה: ibgw.env משני הסודות');
    for (const bad of ['short1', 'has space1', 'dol$lar123', 'quo"te1234', 'hash#12345']) { const e2 = []; P.ibgwFile({ IBGW_PAPER_USER: 'paperusr1', IBGW_PAPER_PASS: bad }, e2); ok(e2.length === 1 && !e2[0].includes(bad), 'סיסמה לא תקינה נדחית בלי להדפיס אותה: ' + bad.replace(/./g, '•')); }
    const e3 = []; P.ibgwFile({ IBGW_PAPER_USER: 'paperusr1' }, e3);
    ok(e3.length === 1, 'רק אחד מהסודות — שגיאה');
    ok(/IBGW_PAPER_USER: \$\{\{ secrets\.IBGW_PAPER_USER \}\}/.test(R('.github/workflows/server.yml')) && /IBGW_PAPER_PASS: \$\{\{ secrets\.IBGW_PAPER_PASS \}\}/.test(R('.github/workflows/hostfix.yml')), 'workflows: server ו־hostfix מקבלים את הסודות');
  }

  console.log('\n' + pass + '/' + (pass + fail));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
