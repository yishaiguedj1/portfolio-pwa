/* "הקמת שרת" מ־GitHub (שלב 2ב, 12/10/2026): tools/server-provision.js + .github/workflows/server.yml.
   Firestore, Google OAuth ו־Hetzner מדומים — בלי רשת ובלי סודות אמיתיים. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const P = require('../tools/server-provision.js');

let n = 0, bad = 0;
const ok = (c, m) => { n++; if (c) console.log('ok - ' + m); else { bad++; console.log('not ok - ' + m); } };
const throwsCode = async (fn, code) => { try { await fn(); return false; } catch (e) { return e.code === code; } };
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const SA = { type: 'service_account', project_id: 'snowball-staging-758f6', client_email: 'x@snowball-staging-758f6.iam.gserviceaccount.com', private_key: pem, token_uri: 'https://oauth2.googleapis.com/token' };
const E = {
  STG_FIREBASE_SA: JSON.stringify(SA),
  STG_TUNNEL_TOKEN: 'eyJ' + 'A'.repeat(180),
  STG_R2_ACCESS_KEY_ID: 'a'.repeat(32),
  STG_R2_SECRET_ACCESS_KEY: 'b'.repeat(64),
  STG_ANTHROPIC_KEY: 'sk-ant-api03-' + 'K'.repeat(80),
  STG_ADMIN_EMAIL: 'Admin@Example.com',
  CLOUDFLARE_ACCOUNT_ID: 'c'.repeat(32),
  HCLOUD_TOKEN: 'H'.repeat(64),
  PROD_FIREBASE_SA: JSON.stringify(Object.assign({}, SA, { project_id: 'yishaiguedj1-c786e', client_email: 'x@yishaiguedj1-c786e.iam.gserviceaccount.com' })),
  PROD_ANTHROPIC_KEY: 'sk-ant-api03-' + 'P'.repeat(80),
};
const TYPES = { cax21: 8, cax31: 16, cx43: 16, cx22: 4 };

function mock(opts = {}) {
  const calls = [], docs = {};
  let t = 1_000_000, healthAfter = opts.healthAfter || 0, seenAfter = opts.seenAfter || 0;
  const fetch = async (url, init = {}) => {
    const m = init.method || 'GET';
    calls.push({ url, m, body: init.body, auth: (init.headers || {}).Authorization });
    const res = (status, j, text) => ({ status, json: async () => j, text: async () => (text != null ? text : JSON.stringify(j)) });
    if (url === 'https://oauth2.googleapis.com/token') return res(200, { access_token: 'ya29.test', expires_in: 3600 });
    if (url.startsWith('https://firestore.googleapis.com/v1/projects/')) {
      const id = url.split('/documents/')[1].split('?')[0];
      if (m === 'GET' && !id.includes('/')) return res(200, { documents: Object.keys(docs).filter((k) => k.startsWith(id + '/'))
        .map((k) => ({ name: 'projects/p/databases/(default)/documents/' + k, fields: docs[k] })) });
      if (m === 'PATCH') { if (docs[id] && url.includes('exists=false')) return res(409, {}); docs[id] = JSON.parse(init.body).fields; return res(200, {}); }
      if (m === 'DELETE') { delete docs[id]; return res(200, {}); }
      if (!docs[id]) return res(404, {});
      return res(200, { fields: Object.assign({}, docs[id], t >= seenAfter ? { seen: { integerValue: String(t) } } : {}) });
    }
    if (url.startsWith('https://api.hetzner.cloud/v1/')) {
      const p = url.slice('https://api.hetzner.cloud/v1'.length);
      if (p.startsWith('/servers?name=')) return res(200, { servers: opts.exists ? [{ id: 9 }] : [] });
      if (p.startsWith('/server_types?name=')) { const t0 = decodeURIComponent(p.split('=')[1]); return res(200, { server_types: TYPES[t0] ? [{ name: t0, memory: TYPES[t0] }] : [] }); }
      if (p === '/firewalls?name=snb-closed') return res(200, { firewalls: opts.fw ? [opts.fw] : [] });
      if (p === '/firewalls' && m === 'POST') return res(201, { firewall: { id: 77, rules: [] } });
      if (p === '/servers' && m === 'POST') return res(opts.createStatus || 201, { server: { id: 123 } });
    }
    if (url.startsWith('https://api.vercel.com/')) {
      calls[calls.length - 1].vauth = (init.headers || {}).Authorization;
      const V = opts.vercel || {};
      if (V.status) return res(V.status, {});
      if (url.includes('/v10/projects/ibkr-proxy/env?decrypt=true')) return res(200, { envs: V.envs || [], hiddenProductionEnvCount: V.hidden || 0 });
      const one = url.match(/\/v1\/projects\/ibkr-proxy\/env\/([A-Za-z0-9_-]+)/);
      if (one && V.one && V.one[one[1]] != null) return res(200, { value: V.one[one[1]], decrypted: true });
      return res(404, {});
    }
    if (url === 'https://api.thesnowball.app/healthz') {
      if (t < (opts.prodHealthAfter || 0)) throw new Error('down');
      return res(200, null, 'ok');
    }
    if (url === 'https://api-staging.thesnowball.app/healthz') {
      if (t < healthAfter) throw new Error('down');
      return res(200, null, 'ok');
    }
    return res(404, {});
  };
  return { calls, docs, deps: { fetch, now: () => t, sleep: async (ms) => { t += ms; } } };
}

(async () => {
  const env = P.ENVS.stg;

  /* ---------- רישום טוקן השרת ---------- */
  {
    const M = mock();
    const r = await P.register(E, env, 'snb-stg-1', M.deps);
    ok(/^[a-z0-9]{12}-[A-Za-z0-9_-]{43}$/.test(r.token) && r.token.startsWith(r.sid + '-'), 'רישום: טוקן בצורה שהשרתון מכיר (SRV_TOKEN_RE)');
    const d = M.docs['studioServers/' + r.sid] || M.docs[r.sid];
    const doc = Object.values(M.docs)[0];
    ok(doc && doc.th.stringValue === crypto.createHash('sha256').update(r.token).digest('hex') && !JSON.stringify(doc).includes(r.token),
      'רישום: ב־Firestore רק ה־hash, לא הטוקן');
    ok(doc.seen.integerValue === '0' && doc.paused.booleanValue === false && doc.name.stringValue === 'snb-stg-1', 'רישום: שרת חדש — לא נראה עדיין, לא מושהה');
    const fsCall = M.calls.find((c) => c.url.includes('firestore') && c.m === 'PATCH');
    ok(fsCall.url.includes('/projects/snowball-staging-758f6/') && fsCall.url.includes('currentDocument.exists=false'), 'רישום: לפרויקט של הניסוי, בלי לדרוס מסמך קיים');
    void d;
    const prodSa = Object.assign({}, SA, { project_id: 'yishaiguedj1-c786e' });
    ok(await throwsCode(() => P.register(Object.assign({}, E, { STG_FIREBASE_SA: JSON.stringify(prodSa) }), env, 'snb-stg-1', mock().deps), 'sa_project'),
      'חשבון שירות של הייצור בסביבת הניסוי — עצירה');
    ok(await throwsCode(() => P.register(Object.assign({}, E, { STG_FIREBASE_SA: Buffer.from(JSON.stringify(SA)).toString('base64') }), env, 'a1', mock().deps), 'fs_http_404') === false,
      'חשבון שירות גם ב־base64');
  }

  /* ---------- קוד ההקמה ---------- */
  const tpl = read('infra/cloud-init.yaml');
  const token = 'abcdefabcdef-' + 'Z'.repeat(43);
  const ci = P.cloudInit(tpl, P.stagingFiles(env, E, token));
  ok(ci.startsWith('#cloud-config') && !ci.includes(P.MARK) && Buffer.byteLength(ci) < 32 * 1024, 'קוד ההקמה: בלי שורת הסימון, ומתחת ל־32KB של Hetzner');
  for (const f of ['/etc/snb/tunnel.env', '/etc/snb/app-stg.env', '/etc/snb/worker-stg.env'])
    ok(new RegExp('path: ' + f.replace(/\//g, '\\/').replace(/\./g, '\\.') + '\\n    permissions: "0600"').test(ci) && ci.indexOf(f) < ci.indexOf('\nruncmd:'),
      'קוד ההקמה: ' + f + ' בהרשאות 600, בתוך write_files');
  ok(ci.includes('      FIREBASE_PROJECT_ID=snowball-staging-758f6\n') && ci.includes('      R2_BUCKET=snb-staging\n') && ci.includes('      LIBRARY_ADMINS=admin@example.com\n'),
    'קוד ההקמה: פרויקט ודלי של הניסוי, מייל המנהל באותיות קטנות');
  ok(!ci.includes('BEGIN PRIVATE KEY') && ci.includes('GDRIVE_SA_KEY=' + Buffer.from(JSON.stringify(SA)).toString('base64') + '\n'),
    'קוד ההקמה: חשבון השירות בשורה אחת (base64), לא PEM על כמה שורות');
  ok(ci.includes('SNB_WORKER_TOKEN=' + token + '\n') && ci.includes('ANTHROPIC_API_KEY=' + E.STG_ANTHROPIC_KEY + '\n'), 'קוד ההקמה: הטוקן והמפתח לעובד הניסוי');
  ok(/CRON_SECRET=[0-9a-f]{48}\n/.test(ci), 'קוד ההקמה: סוד קרון אקראי לכל שרת');
  ok(ci.includes('if ls /etc/snb/*.env >/dev/null 2>&1; then chmod 600 /etc/snb/*.env; systemctl start --no-block snb-update.service; fi'),
    'קוד ההקמה: יש קובץ סודות של חדר כלשהו — מתחילים מיד');
  for (const [k, v] of [['STG_ANTHROPIC_KEY', 'sk-ant-x\nruncmd: [evil]'], ['STG_TUNNEL_TOKEN', 'abc'], ['STG_R2_SECRET_ACCESS_KEY', 'b'.repeat(63) + '"'],
    ['STG_ADMIN_EMAIL', 'x@y.com\nZ=1'], ['CLOUDFLARE_ACCOUNT_ID', '']]) {
    let threw = false;
    try { P.cloudInit(tpl, P.stagingFiles(env, Object.assign({}, E, { [k]: v }), token)); } catch (e) { threw = !!e.code && !String(e.message).includes(v.slice(4, 12) || '§'); }
    ok(threw, 'קוד ההקמה: ' + k + ' לא תקין — נדחה (בלי הזרקת YAML), וההודעה בלי הערך');
  }
  ok((() => { try { P.cloudInit(tpl.replace(P.MARK, ''), []); return false; } catch (e) { return e.code === 'tpl'; } })(), 'תבנית בלי שורת סימון — נדחית');
  /* 13/10/2026 — לקוח OAuth של Google בניסוי (גיבוי הספרייה ו־Drive של הסטודיו): רשות, שני הסודות יחד, בצורה קשיחה */
  {
    const app = (x) => P.stagingFiles(env, Object.assign({}, E, x), token).find((f) => f.path === '/etc/snb/app-stg.env').lines.join('\n');
    ok(!/GDRIVE_CLIENT/.test(app({})), 'Drive בניסוי: בלי הסודות — בלי שורות (כמו קודם)');
    const G = { STG_GDRIVE_CLIENT_ID: ' 123456789012-' + 'a'.repeat(32) + '.apps.googleusercontent.com ', STG_GDRIVE_CLIENT_SECRET: 'GOCSPX-' + 'Ab_c-'.repeat(5) + 'x',
      STG_STUDIO_GDRIVE_CLIENT_ID: '98765432-' + 'b'.repeat(32) + '.apps.googleusercontent.com', STG_STUDIO_GDRIVE_CLIENT_SECRET: 'GOCSPX-' + 'Q'.repeat(28) };
    const a = app(G);
    ok(a.includes('\nGDRIVE_CLIENT_ID=123456789012-' + 'a'.repeat(32) + '.apps.googleusercontent.com') && a.includes('\nGDRIVE_CLIENT_SECRET=' + G.STG_GDRIVE_CLIENT_SECRET)
      && a.includes('\nSTUDIO_GDRIVE_CLIENT_ID=' + G.STG_STUDIO_GDRIVE_CLIENT_ID) && a.includes('\nSTUDIO_GDRIVE_CLIENT_SECRET=' + G.STG_STUDIO_GDRIVE_CLIENT_SECRET),
      'Drive בניסוי: שני הלקוחות נכנסים ל־app-stg.env (מנוקים מרווחים)');
    for (const [k, v] of [['STG_GDRIVE_CLIENT_SECRET', ''], ['STG_GDRIVE_CLIENT_ID', 'x.apps.googleusercontent.com\nZ=1'], ['STG_STUDIO_GDRIVE_CLIENT_SECRET', 'secret123']]) {
      let msg = '';
      try { app(Object.assign({}, G, { [k]: v })); } catch (e) { msg = e.message; }
      ok(msg.includes(k) && (!v || !msg.includes(v.slice(0, 6))), 'Drive בניסוי: ' + k + ' חסר או לא תקין — נדחה, וההודעה בלי הערך');
    }
  }
  /* 12/10/2026 — הסוד של R2 נפסל פעמיים בלי לדעת למה: ההודעה אומרת עכשיו את הצורה (אורך + סוגי תווים), לא את הערך */
  {
    const up = P.cloudInit(tpl, P.stagingFiles(env, Object.assign({}, E, { STG_R2_SECRET_ACCESS_KEY: ' ' + 'B'.repeat(32) + '\n' + 'b'.repeat(32) + ' ' }), token));
    ok(up.includes('      R2_SECRET_ACCESS_KEY=' + 'b'.repeat(64) + '\n'), 'hex באותיות גדולות / עם רווח או שורה מההדבקה — מנורמל ומתקבל');
    const tokenValue = 'Ab3' + 'xY9_'.repeat(9) + 'Q';   // כמו Token value של Cloudflare — לא הסוד
    let msg = '';
    try { P.stagingFiles(env, Object.assign({}, E, { STG_R2_SECRET_ACCESS_KEY: tokenValue }), token); } catch (e) { msg = e.message; }
    ok(msg.includes('STG_R2_SECRET_ACCESS_KEY') && msg.includes(tokenValue.length + ' תווים') && msg.includes('אותיות גדולות') && msg.includes('64 תווים'),
      'ערך שגוי — ההודעה: שם הסוד, האורך שהתקבל, סוגי התווים, ומה מצופה');
    ok(!msg.includes(tokenValue.slice(0, 8)) && !msg.includes('xY9_'), 'ההודעה בלי הערך עצמו');
    ok(P.shape('') === '0 תווים', 'סוד ריק — "0 תווים"');
    let all = '';
    try { P.stagingFiles(env, Object.assign({}, E, { STG_R2_SECRET_ACCESS_KEY: 'x', STG_ANTHROPIC_KEY: 'nope', STG_ADMIN_EMAIL: '' }), token); } catch (e) { all = e.message; }
    ok(all.startsWith('3 סודות לא תקינים') && all.includes('STG_R2_SECRET_ACCESS_KEY') && all.includes('STG_ANTHROPIC_KEY') && all.includes('מייל המנהל'),
      'כמה סודות שגויים — כולם בהודעה אחת (לא ריצה לכל אחד)');
  }

  /* ---------- Hetzner ---------- */
  {
    const M = mock();
    const r = await P.create(E, { name: 'snb-stg-1', type: 'cax21', location: 'nbg1', env: 'stg' }, ci, M.deps);
    const post = M.calls.find((c) => c.url.endsWith('/v1/servers') && c.m === 'POST');
    const b = JSON.parse(post.body);
    ok(r.id === 123 && b.image === 'debian-13' && b.server_type === 'cax21' && b.user_data === ci && b.start_after_create === true, 'יצירה: Debian 13, הסוג שנבחר, קוד ההקמה');
    ok(b.firewalls[0].firewall === 77 && M.calls.some((c) => c.url.endsWith('/v1/firewalls') && c.m === 'POST' && JSON.parse(c.body).rules.length === 0),
      'יצירה: חומת אש snb-closed בלי אף כלל (נוצרת כשאין)');
    ok(post.auth === 'Bearer ' + E.HCLOUD_TOKEN && b.labels.snb === 'stg', 'יצירה: הטוקן של Hetzner רק בכותרת; תווית הסביבה');
    ok(await throwsCode(() => P.create(E, { name: 'snb-stg-1', type: 'cax21', location: 'nbg1', env: 'stg' }, ci, mock({ exists: true }).deps), 'exists'),
      'יצירה: שרת באותו שם — עוצרים, לא דורסים');
    ok(await throwsCode(() => P.create(E, { name: 'snb-stg-1', type: 'cax21', location: 'nbg1', env: 'stg' }, ci,
      mock({ fw: { id: 5, rules: [{ direction: 'in', port: '22' }] } }).deps), 'fw_open'), 'יצירה: חומת אש קיימת עם כלל נכנס — עוצרים');
    ok(await throwsCode(() => P.create(E, { name: 'Bad Name', type: 'cax21', location: 'nbg1', env: 'stg' }, ci, mock().deps), 'opts')
      && await throwsCode(() => P.create(E, { name: 'snb-stg-1', type: 'cax21;rm', location: 'nbg1', env: 'stg' }, ci, mock().deps), 'opts'),
      'יצירה: שם/סוג לא תקין — נדחה לפני כל קריאה');
    ok(await throwsCode(() => P.create(E, { name: 'snb-stg-1', type: 'cax21', location: 'nbg1', env: 'stg' }, ci, mock({ createStatus: 422 }).deps), 'hcloud_422'),
      'יצירה: Hetzner סירב — שגיאה עם הקוד');
  }

  /* ---------- מחכים ---------- */
  {
    const M = mock({ healthAfter: 1_000_000 + 5 * 60e3, seenAfter: 1_000_000 + 12 * 60e3 });
    const r0 = await P.register(E, env, 'snb-stg-1', M.deps);
    const r = await P.waitUp(E, env, r0.sid, M.deps);
    ok(r.health && r.seen > 0, 'מחכים: השרתון עונה דרך ה־Tunnel, ואז העובד מדווח');
    const M2 = mock({ healthAfter: Infinity });
    const r2 = await P.waitUp(E, env, 'abcdefabcdef', M2.deps, { health: 60e3, every: 20e3 });
    ok(!r2.health && !M2.calls.some((c) => c.url.includes('firestore')), 'מחכים: השרתון לא עונה — עוצרים בזמן, בלי לבדוק את העובד');
    const ru = await P.unregister(E, env, r0.sid, M.deps);
    ok(ru && !Object.keys(M.docs).length, 'ניקוי: הרישום נמחק');
    ok(await P.unregister(E, env, '../x', M.deps) === false, 'ניקוי: מזהה לא תקין — לא נוגעים');
  }

  /* ---------- שרת אחד לכל המערכת (plan all, 12/10/2026) ---------- */
  {
    const tokP = 'pppppppppppp-' + 'P'.repeat(43);
    const all = P.cloudInit(tpl, P.planFiles('all', E, { stg: token, prod: tokP }));
    ok(['/etc/snb/worker.env', '/etc/snb/tunnel.env', '/etc/snb/app-stg.env', '/etc/snb/worker-stg.env'].every((f) => all.includes('path: ' + f + '\n    permissions: "0600"')),
      'all: ארבעת קובצי הסודות — העובד של הייצור + שלושת חדרי הניסוי');
    const wk = all.split('path: /etc/snb/worker.env')[1].split('  - path:')[0];
    ok(wk.includes('ANTHROPIC_API_KEY=' + E.PROD_ANTHROPIC_KEY + '\n') && wk.includes('SNB_WORKER_TOKEN=' + tokP + '\n') && !wk.includes(E.STG_ANTHROPIC_KEY),
      'all: לעובד של הייצור — המפתח והטוקן של הייצור, לא של הניסוי');
    ok(Buffer.byteLength(all) < 32 * 1024, 'all: עדיין מתחת ל־32KB של Hetzner (' + Buffer.byteLength(all) + ')');
    const only = P.cloudInit(tpl, P.planFiles('stg', E, { stg: token }));
    ok(!only.includes('path: /etc/snb/worker.env'), 'stg: בלי חדר הייצור');
    let msg = '';
    try { P.planFiles('all', Object.assign({}, E, { PROD_ANTHROPIC_KEY: '', STG_ANTHROPIC_KEY: 'x' }), { stg: token, prod: tokP }); } catch (e) { msg = e.message; }
    ok(msg.startsWith('2 סודות לא תקינים') && msg.includes('PROD_ANTHROPIC_KEY') && msg.includes('STG_ANTHROPIC_KEY'), 'all: סודות שגויים משני החדרים — בהודעה אחת');
    ok(await throwsCode(async () => P.planFiles('all', E, { stg: token, prod: '' }), 'secret_bad'), 'all: בלי טוקן לייצור — עצירה');
    ok(await throwsCode(async () => P.planFiles('nope', E, {}), 'plan'), 'תוכנית לא מוכרת — עצירה');

    // רישום בפרויקט של הייצור, עם חשבון השירות של הייצור בלבד
    const M = mock();
    const r = await P.register(E, P.ENVS.prod, 'snb-1', M.deps);
    const put = M.calls.find((c) => c.m === 'PATCH');
    ok(put.url.includes('/projects/yishaiguedj1-c786e/') && r.token.startsWith(r.sid + '-'), 'all: טוקן הייצור נרשם בפרויקט של הייצור');
    ok(await throwsCode(() => P.register(Object.assign({}, E, { PROD_FIREBASE_SA: E.STG_FIREBASE_SA }), P.ENVS.prod, 'snb-1', mock().deps), 'sa_project'),
      'all: חשבון שירות של הניסוי במקום של הייצור — עצירה');
    // הבעלים — המנהל מ־sysBackup/cfg (להתראת "השרת נפל")
    const M2 = mock();
    M2.docs['sysBackup/cfg'] = { uid: { stringValue: 'AbCdEf0123456789' } };
    await P.register(E, P.ENVS.stg, 'snb-1', M2.deps);
    const d2 = Object.entries(M2.docs).find(([k]) => k.startsWith('studioServers/'))[1];
    ok(d2.by.stringValue === 'AbCdEf0123456789', 'רישום: by = המנהל, כדי שהתראת "השרת נפל" תגיע אליו');
    const M3 = mock();
    M3.docs['sysBackup/cfg'] = { uid: { stringValue: '../x' } };
    await P.register(E, P.ENVS.stg, 'snb-1', M3.deps);
    ok(Object.entries(M3.docs).find(([k]) => k.startsWith('studioServers/'))[1].by.stringValue === '', 'רישום: מזהה מנהל לא תקין — ריק');

    // ייצור (ת3): קודם השרתון שלו עונה ב־api.thesnowball.app, ואז העובד
    const M4 = mock({ healthAfter: Infinity, prodHealthAfter: 1_000_000 + 2 * 60e3, seenAfter: 1_000_000 + 3 * 60e3 });
    const rp = await P.register(E, P.ENVS.prod, 'snb-1', M4.deps);
    const w4 = await P.waitUp(E, P.ENVS.prod, rp.sid, M4.deps);
    ok(w4.health && w4.seen > 0 && M4.calls.some((c) => c.url === 'https://api.thesnowball.app/healthz')
      && !M4.calls.some((c) => c.url.includes('api-staging')), 'all: ייצור — מחכים לשרתון של הייצור ואז לעובד');

    // גודל השרת
    const ciAll = all;
    ok(await throwsCode(() => P.create(E, { name: 'snb-1', type: 'cax21', location: 'nbg1', plan: 'all' }, ciAll, mock().deps), 'too_small'),
      'all: שרת של 8GB — קטן מדי לייצור + ניסוי, עוצרים לפני היצירה');
    const M5 = mock();
    await P.create(E, { name: 'snb-1', type: 'cax31', location: 'nbg1', plan: 'all' }, ciAll, M5.deps);
    const b5 = JSON.parse(M5.calls.find((c) => c.url.endsWith('/v1/servers') && c.m === 'POST').body);
    ok(b5.server_type === 'cax31' && b5.labels.snb === 'all', 'all: 16GB — נוצר, עם תווית התוכנית');
    ok(await throwsCode(() => P.create(E, { name: 'snb-1', type: 'cax99', location: 'nbg1', plan: 'all' }, ciAll, mock().deps), 'type'),
      'סוג שרת שלא קיים ב־Hetzner — עצירה');
    // ברירות מחדל לשם ולסוג לפי התוכנית
    ok(await P.main(['defaults', '--plan', 'all'], E, mock().deps) === 'name=snb-1\ntype=cax31'
      && await P.main(['defaults', '--plan', 'stg'], E, mock().deps) === 'name=snb-stg-1\ntype=cax21'
      && await P.main(['defaults', '--plan', 'all', '--name', 'snb-2', '--type', 'cx43'], E, mock().deps) === 'name=snb-2\ntype=cx43',
      'ברירות מחדל: all → snb-1 / cax31, stg → snb-stg-1 / cax21, ומה שהוזן גובר');
    ok(await throwsCode(() => P.main(['defaults', '--plan', 'all', '--name', 'a\ntype=x'], E, mock().deps), 'opts'),
      'ברירות מחדל: שם עם שורה חדשה — נדחה (לא נכנס ל־GITHUB_OUTPUT)');
  }

  /* ---------- ת3: השרתון של הייצור — הסודות מ־Vercel ---------- */
  {
    const zlib = require('zlib');
    const tokP = 'pppppppppppp-' + 'P'.repeat(43);
    const SAP = Object.assign({}, SA, { project_id: 'yishaiguedj1-c786e' });
    const envs = [
      { id: 'env_1', key: 'GDRIVE_SA_KEY', value: JSON.stringify(SAP), type: 'encrypted', target: ['production', 'preview'], decrypted: true },
      { id: 'env_2', key: 'LIBRARY_READERS', value: 'a@x.com, b@y.com # c', type: 'encrypted', target: ['production'], decrypted: true },
      { id: 'env_3', key: 'GEMINI_API_KEY', value: '', type: 'encrypted', target: ['production'], decrypted: false },
      { id: 'env_4', key: 'R2_SECRET_ACCESS_KEY', value: '', type: 'sensitive', target: ['production'] },
      { id: 'env_5', key: 'VERCEL_URL', value: 'x', type: 'system', target: ['production'], decrypted: true },
      { id: 'env_6', key: 'SNB_CRON', value: 'on', type: 'plain', target: ['production'], decrypted: true },
      { id: 'env_7', key: 'PREVIEW_ONLY', value: 'p', type: 'plain', target: ['preview'], decrypted: true },
      { id: 'env_8', key: 'APP_KEY', value: "q'$HOME\"", type: 'plain', target: 'production', decrypted: true },
    ];
    const M = mock({ vercel: { envs, one: { env_3: 'AIza-gem' } } });
    const vars = await P.vercelEnv(Object.assign({}, E, { VERCEL_TOKEN: 'v'.repeat(24) }), M.deps);
    ok(M.calls.every((c) => !c.url.startsWith('https://api.vercel.com/') || c.vauth === 'Bearer ' + 'v'.repeat(24)), 'Vercel: הטוקן בכותרת בלבד');
    ok(vars.find((x) => x.key === 'GEMINI_API_KEY').value === 'AIza-gem', 'Vercel: ערך שלא פוענח ברשימה — נקרא לבד');
    ok(vars.find((x) => x.key === 'R2_SECRET_ACCESS_KEY').value === null && !vars.some((x) => x.key === 'PREVIEW_ONLY'), 'Vercel: Sensitive = בלי ערך; רק production');
    let msg = '';
    try { P.appEnvLine(vars, '', 'yishaiguedj1-c786e'); } catch (e) { msg = e.message; }
    ok(msg.includes('R2_SECRET_ACCESS_KEY') && msg.includes('PROD_APP_EXTRA') && !msg.includes('AIza') && !msg.includes('BEGIN'),
      'Vercel: משתנה Sensitive בלי חלופה — עצירה עם השם בלבד, בלי ערכים');
    const a = P.appEnvLine(vars, 'R2_SECRET_ACCESS_KEY=' + 'f'.repeat(64) + '\nAPP_KEY=over ride', 'yishaiguedj1-c786e');
    const back = JSON.parse(zlib.gunzipSync(Buffer.from(a.line.slice('SNB_ENV_GZ='.length), 'base64')).toString());
    ok(back.LIBRARY_READERS === 'a@x.com, b@y.com # c' && back.GEMINI_API_KEY === 'AIza-gem' && back.R2_SECRET_ACCESS_KEY === 'f'.repeat(64)
      && back.APP_KEY === 'over ride' && JSON.parse(back.GDRIVE_SA_KEY).private_key === pem,
      'SNB_ENV_GZ: ערכים כמו שהם (רווח, #), PROD_APP_EXTRA ממלא וגובר, חשבון השירות זהה בדיוק');
    ok(!('VERCEL_URL' in back) && !('SNB_CRON' in back) && a.vault === 's', 'SNB_ENV_GZ: בלי משתני Vercel ובלי SNB_CRON (השרת קובע); הכספת נגזרת מחשבון השירות');
    const AS = require('../ibkr-proxy/server.js');
    const env2 = { SNB_ENV_GZ: a.line.split('=').slice(1).join('=') };
    ok(AS.unpackEnv(env2) === Object.keys(back).length && env2.GDRIVE_SA_KEY === back.GDRIVE_SA_KEY, 'השרתון פותח את השורה שהכלי בנה');
    // 15/10/2026: מאגר הלמידה (R2L_*) — רשות. Sensitive בלי חלופה = השרת מוקם בלי אף אחד מהם, עם SNB_LEARN_REMOTE
    const lv = vars.filter((x) => x.key !== 'R2_SECRET_ACCESS_KEY').concat([{ key: 'R2L_BUCKET', value: 'snb-learn' }, { key: 'R2L_ACCESS_KEY_ID', value: null }, { key: 'R2L_SECRET_ACCESS_KEY', value: null }]);
    const la = P.appEnvLine(lv, '', 'yishaiguedj1-c786e');
    const lb = JSON.parse(zlib.gunzipSync(Buffer.from(la.line.slice('SNB_ENV_GZ='.length), 'base64')).toString());
    ok(la.opt.join() === 'R2L_ACCESS_KEY_ID,R2L_SECRET_ACCESS_KEY' && lb.SNB_LEARN_REMOTE === '1' && !Object.keys(lb).some((k) => /^R2L_/.test(k)),
      'R2L_* Sensitive — לא עוצר: בלי אף משתנה של המאגר (לא חצי הגדרה), SNB_LEARN_REMOTE=1, והשמות לאזהרה');
    const lc = P.appEnvLine(lv, 'R2L_ACCESS_KEY_ID=k1\nR2L_SECRET_ACCESS_KEY=k2', 'yishaiguedj1-c786e');
    const ld = JSON.parse(zlib.gunzipSync(Buffer.from(lc.line.slice('SNB_ENV_GZ='.length), 'base64')).toString());
    ok(!lc.opt.length && !('SNB_LEARN_REMOTE' in ld) && ld.R2L_BUCKET === 'snb-learn' && ld.R2L_SECRET_ACCESS_KEY === 'k2', 'עם PROD_APP_EXTRA — המאגר נכנס לשרת כרגיל');
    ok(await throwsCode(async () => P.appEnvLine(lv.concat([{ key: 'OTHER_KEY', value: null }]), '', 'yishaiguedj1-c786e'), 'vercel_sensitive'), 'משתנה אחר Sensitive — עדיין עוצר');
    ok(await throwsCode(async () => P.appEnvLine([{ key: 'X', value: '1' }], '', 'yishaiguedj1-c786e'), 'vercel_sa'), 'Vercel: בלי חשבון שירות — עצירה');
    ok(await throwsCode(async () => P.appEnvLine([{ key: 'GDRIVE_SA_KEY', value: JSON.stringify(SAP) }, { key: 'FIREBASE_PROJECT_ID', value: 'other' }], '', 'yishaiguedj1-c786e'), 'vercel_project_id'),
      'Vercel: פרויקט Firebase אחר — עצירה');
    ok(await throwsCode(async () => P.parseExtra('lower=1'), 'extra_bad'), 'PROD_APP_EXTRA: שם לא תקין — עצירה');
    ok(await throwsCode(() => P.vercelEnv(Object.assign({}, E, { VERCEL_TOKEN: '' }), mock().deps), 'vercel_token'), 'Vercel: בלי טוקן — עצירה');
    ok(await throwsCode(() => P.vercelEnv(Object.assign({}, E, { VERCEL_TOKEN: 'v'.repeat(24) }), mock({ vercel: { status: 403 } }).deps), 'vercel_auth'), 'Vercel: טוקן נדחה — עצירה');
    ok(await throwsCode(() => P.vercelEnv(Object.assign({}, E, { VERCEL_TOKEN: 'v'.repeat(24) }), mock({ vercel: { envs, hidden: 2 } }).deps), 'vercel_hidden'),
      'Vercel: משתני ייצור מוסתרים מהטוקן — עצירה (לא שרתון חסר)');

    // GDRIVE_SA_KEY מסומן Sensitive — PROD_FIREBASE_SA נכנס במקומו רק אם הכספת של הייצור נפתחת בו
    {
      const VT = require('../ibkr-proxy/lib/vault.js');
      const sealWith = (saJson, ek) => {
        const p0 = process.env.GDRIVE_SA_KEY, p1 = process.env.IBKR_VAULT_KEY;
        process.env.GDRIVE_SA_KEY = saJson; if (ek) process.env.IBKR_VAULT_KEY = ek; else delete process.env.IBKR_VAULT_KEY;
        const s = VT.seal({ pub: 'P', d: 'D' }, 'webpush|vapid');
        if (p0 === undefined) delete process.env.GDRIVE_SA_KEY; else process.env.GDRIVE_SA_KEY = p0;
        if (p1 === undefined) delete process.env.IBKR_VAULT_KEY; else process.env.IBKR_VAULT_KEY = p1;
        return s;
      };
      const sensEnvs = [
        { id: 'env_1', key: 'GDRIVE_SA_KEY', value: '', type: 'sensitive', target: ['production'] },
        { id: 'env_2', key: 'LIBRARY_READERS', value: 'a@x.com', type: 'encrypted', target: ['production'], decrypted: true },
      ];
      const EV = Object.assign({}, E, { VERCEL_TOKEN: 'v'.repeat(24) });
      const Mv = mock({ vercel: { envs: sensEnvs } });
      Mv.docs['studioVault/_vapid'] = { vk: { stringValue: sealWith(E.PROD_FIREBASE_SA) } };
      const av = await P.appEnv(EV, Mv.deps);
      const bv = JSON.parse(zlib.gunzipSync(Buffer.from(av.line.slice('SNB_ENV_GZ='.length), 'base64')).toString());
      const saBack = JSON.parse(Buffer.from(bv.GDRIVE_SA_KEY, 'base64').toString());
      ok(av.sa === 'g' && saBack.private_key === pem && saBack.project_id === 'yishaiguedj1-c786e' && bv.LIBRARY_READERS === 'a@x.com',
        'חשבון השירות Sensitive: PROD_FIREBASE_SA נכנס אחרי שהכספת נפתחה בו');
      const { privateKey: other } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      const otherSa = JSON.stringify(Object.assign(JSON.parse(E.PROD_FIREBASE_SA), { private_key: other.export({ type: 'pkcs8', format: 'pem' }) }));
      const Mm = mock({ vercel: { envs: sensEnvs } });
      Mm.docs['studioVault/_vapid'] = { vk: { stringValue: sealWith(otherSa) } };
      let mm = '';
      try { await P.appEnv(EV, Mm.deps); } catch (x) { mm = x.code + ' ' + x.message; }
      ok(mm.startsWith('sa_mismatch') && !mm.includes('BEGIN'), 'מפתח אחר של אותו חשבון (הכספת לא נפתחת) — עצירה, בלי ערכים בהודעה');
      ok(await throwsCode(() => P.appEnv(EV, mock({ vercel: { envs: sensEnvs } }).deps), 'sa_unverified'), 'בלי רשומת כספת לבדיקה — עצירה (לא מנחשים)');
      // בלי רשומת VAPID (התראות לא הופעלו) — רשומת IBKR / Drive של משתמש מספיקה
      const sealAad = (saJson, aad) => {
        const p0 = process.env.GDRIVE_SA_KEY; process.env.GDRIVE_SA_KEY = saJson; delete process.env.IBKR_VAULT_KEY;
        const s = VT.seal({ t: 'x' }, aad);
        if (p0 === undefined) delete process.env.GDRIVE_SA_KEY; else process.env.GDRIVE_SA_KEY = p0;
        return s;
      };
      const Mi = mock({ vercel: { envs: sensEnvs } });
      Mi.docs['ibkrVault/U1abc'] = { c: { stringValue: sealAad(E.PROD_FIREBASE_SA, 'U1abc|c') } };
      ok((await P.appEnv(EV, Mi.deps)).sa === 'g', 'בלי רשומת VAPID — רשומת IBKR של משתמש מאמתת את המפתח');
      const Md = mock({ vercel: { envs: sensEnvs } });
      Md.docs['driveVault/U2xyz'] = { r: { stringValue: sealAad(E.PROD_FIREBASE_SA, 'gdrive|U2xyz|r') } };
      ok((await P.appEnv(EV, Md.deps)).sa === 'g', 'רשומת Drive של הספרייה — מאמתת את המפתח');
      const Mw = mock({ vercel: { envs: sensEnvs } });
      Mw.docs['driveVault/U2xyz'] = { r: { stringValue: sealAad(E.PROD_FIREBASE_SA, 'gdrive|OTHER|r') } };
      ok(await throwsCode(() => P.appEnv(EV, Mw.deps), 'sa_mismatch'), 'רשומה שלא נפתחת (AAD אחר) — לא נחשבת אימות');
      const ek = crypto.randomBytes(32).toString('base64');
      const Me = mock({ vercel: { envs: sensEnvs } });
      Me.docs['studioVault/_vapid'] = { vk: { stringValue: sealWith(E.PROD_FIREBASE_SA, ek) } };
      ok(await throwsCode(() => P.appEnv(EV, Me.deps), 'vault_key_missing'), 'כספת ב־IBKR_VAULT_KEY שמסומן Sensitive — עצירה עם השם');
      const ae = await P.appEnv(Object.assign({}, EV, { PROD_APP_EXTRA: 'IBKR_VAULT_KEY=' + ek }), Me.deps);
      ok(ae.sa === 'g' && ae.vault === 'e', 'כספת ב־IBKR_VAULT_KEY מ־PROD_APP_EXTRA — נפתחת, וחשבון השירות מ־GitHub');
      ok(process.env.IBKR_VAULT_KEY === undefined, 'הבדיקה לא משאירה את מפתח הכספת בסביבה');
      const Mx = mock({ vercel: { envs: sensEnvs } });
      const ax = await P.appEnv(Object.assign({}, EV, { PROD_APP_EXTRA: 'GDRIVE_SA_KEY=' + Buffer.from(E.PROD_FIREBASE_SA).toString('base64') }), Mx.deps);
      ok(ax.sa === 'x', 'GDRIVE_SA_KEY ב־PROD_APP_EXTRA ואין רשומות בכספת — מתקבל (אין מה לשבור)');
      // הקובץ המקורי מ־PROD_APP_EXTRA — נבדק מול הכספת כמו PROD_FIREBASE_SA; גם חשבון של פרויקט אחר
      const orig = JSON.stringify(Object.assign(JSON.parse(otherSa), { project_id: 'drive-proj' }));
      const Mo = mock({ vercel: { envs: sensEnvs } });
      Mo.docs['studioVault/_vapid'] = { vk: { stringValue: sealWith(orig) } };
      const ao = await P.appEnv(Object.assign({}, EV, { PROD_APP_EXTRA: 'GDRIVE_SA_KEY=' + orig }), Mo.deps);
      const bo = JSON.parse(zlib.gunzipSync(Buffer.from(ao.line.slice('SNB_ENV_GZ='.length), 'base64')).toString());
      ok(ao.sa === 'x' && bo.GDRIVE_SA_KEY === orig, 'הקובץ המקורי מ־PROD_APP_EXTRA פותח את הכספת — הוא שנכנס לשרת');
      ok(String(process.env.GDRIVE_SA_KEY || '') !== Buffer.from(orig).toString('base64'), 'הבדיקה לא משאירה את המפתח שנבדק בסביבה');
      let xm = '';
      try { await P.appEnv(Object.assign({}, EV, { PROD_APP_EXTRA: 'GDRIVE_SA_KEY=' + E.PROD_FIREBASE_SA }), Mo.deps); } catch (x) { xm = x.code + ' ' + x.message; }
      ok(xm.startsWith('extra_sa_mismatch') && !xm.includes('BEGIN'), 'קובץ לא נכון ב־PROD_APP_EXTRA — עצירה, לא עובר בשקט');
      ok(await throwsCode(() => P.appEnv(Object.assign({}, EV, { PROD_APP_EXTRA: 'GDRIVE_SA_KEY={"type":"x"}' }), Mo.deps), 'extra_sa_bad'), 'קובץ שאינו מפתח של חשבון שירות — עצירה');
      // הקובץ כמו שהורד (JSON בכמה שורות) בין שורות אחרות — מתקבל, נשמר בשורה אחת
      const pretty = JSON.stringify(JSON.parse(orig), null, 2);
      const ap = await P.appEnv(Object.assign({}, EV, { PROD_APP_EXTRA: 'MISTRAL_API_KEY=m1\nGDRIVE_SA_KEY=' + pretty + '\nR2_BUCKET=b' }), Mo.deps);
      const bp = JSON.parse(zlib.gunzipSync(Buffer.from(ap.line.slice('SNB_ENV_GZ='.length), 'base64')).toString());
      ok(ap.sa === 'x' && bp.GDRIVE_SA_KEY === orig && bp.MISTRAL_API_KEY === 'm1' && bp.R2_BUCKET === 'b', 'JSON בכמה שורות ב־PROD_APP_EXTRA — נקרא כמו שהוא, והשורות שאחריו לא נבלעות');
    }

    // טוקני Google במטמון לפי חשבון השירות — תהליך אחד שרושם בניסוי ואז בייצור (ההזמנה האוטומטית)
    {
      const G = require('../ibkr-proxy/lib/gauth.js');
      G._reset();
      let k = 0;
      const f = async () => ({ status: 200, json: async () => ({ access_token: 'ya29.t' + (++k), expires_in: 3600 }) });
      const p0 = process.env.GDRIVE_SA_KEY;
      process.env.GDRIVE_SA_KEY = E.STG_FIREBASE_SA; const t1 = await G.datastoreToken(f); const t1b = await G.datastoreToken(f);
      process.env.GDRIVE_SA_KEY = E.PROD_FIREBASE_SA; const t2 = await G.datastoreToken(f);
      if (p0 === undefined) delete process.env.GDRIVE_SA_KEY; else process.env.GDRIVE_SA_KEY = p0;
      G._reset();
      ok(t1 === t1b && t2 !== t1, 'מטמון הטוקנים לפי חשבון השירות — הייצור לא מקבל את הטוקן של הניסוי');
    }

    // קובצי הסודות: Tunnel נפרד לייצור, השורה של השרתון, ו־32KB עם ערכים בגודל אמיתי
    const big = [{ key: 'GDRIVE_SA_KEY', value: JSON.stringify(SAP) }];
    for (let i = 0; i < 40; i++) big.push({ key: 'K' + i + '_SECRET', value: crypto.randomBytes(30).toString('base64') });
    const line = P.appEnvLine(big, '', 'yishaiguedj1-c786e').line;
    const E3 = Object.assign({}, E, { PROD_TUNNEL_TOKEN: 'eyJ' + 'B'.repeat(180) });
    const full = P.cloudInit(tpl, P.planFiles('all', E3, { stg: token, prod: tokP }, line));
    ok(full.includes('path: /etc/snb/tunnel-prod.env') && full.includes('TUNNEL_TOKEN=' + E3.PROD_TUNNEL_TOKEN + '\n') && full.includes(line + '\n'),
      'ת3: קובץ ה־Tunnel של הייצור והשורה של השרתון');
    ok(Buffer.byteLength(full) < 32 * 1024, 'ת3: כל ששת החדרים עם 40 משתנים ושני חשבונות שירות — מתחת ל־32KB (' + Buffer.byteLength(full) + ')');
    msg = '';
    try { P.planFiles('all', Object.assign({}, E3, { PROD_TUNNEL_TOKEN: E3.STG_TUNNEL_TOKEN }), { stg: token, prod: tokP }, line); } catch (e) { msg = e.message; }
    ok(msg.includes('PROD_TUNNEL_TOKEN זהה'), 'ת3: אותו Tunnel לייצור ולניסוי — עצירה (הבקשות היו מתחלקות בין שרתים)');
    ok(await throwsCode(async () => P.planFiles('all', E, { stg: token, prod: tokP }, line), 'secret_bad'), 'ת3: בלי PROD_TUNNEL_TOKEN — עצירה');
  }

  /* ---------- ה־workflow ---------- */
  {
    const w = read('.github/workflows/server.yml');
    ok(/^permissions: \{\}$/m.test(w) && /environment: production/.test(w) && /workflow_dispatch:/.test(w) && !/^\s*(push|pull_request|schedule):/m.test(w),
      'workflow: רק ידני, באישור (production), בלי הרשאות ברירת מחדל');
    for (const u of w.match(/uses:\s*\S+/g) || []) ok(/@[0-9a-f]{40}$/.test(u), 'workflow: action נעול ל־SHA: ' + u);
    const runs = w.split('\n').filter((l) => /^\s+run:|^\s{10}\S/.test(l)).join('\n');
    ok(!/\$\{\{/.test(runs.replace(/^\s+[A-Z0-9_]+: \$\{\{[^}]+\}\}$/gm, '')), 'workflow: בלי ביטויים בתוך פקודות — הכל דרך env (בלי הזרקה)');
    ok(/if: failure\(\) && steps\.reg\.outputs\.sid != '' && steps\.create\.outcome != 'success'/.test(w),
      'workflow: ניקוי הרישום רק כשהשרת לא נוצר (שרת חי לא מאבד את הטוקן שלו)');
    ok(/if: always\(\)\n\s+run: rm -f "\$RUNNER_TEMP\/ud" "\$RUNNER_TEMP\/tok" "\$RUNNER_TEMP\/tokp"/.test(w), 'workflow: הקבצים עם הסודות נמחקים תמיד');
    ok(/if: failure\(\) && steps\.regp\.outputs\.sid != '' && steps\.create\.outcome != 'success'[\s\S]{0,200}unregister --env prod/.test(w),
      'workflow: גם הרישום של הייצור נמחק כשהשרת לא נוצר');
    ok(/options: \[stg, all\]/.test(w) && (w.match(/if: inputs\.env == 'all'/g) || []).length === 2,
      'workflow: stg / all — הרישום וההמתנה של הייצור רק בשרת המאוחד');
    ok(/PROD_FIREBASE_SA: \$\{\{ secrets\.PROD_FIREBASE_SA \}\}/.test(w) && !/STG_FIREBASE_SA[^\n]*\n[^\n]*--env prod/.test(w),
      'workflow: לייצור — רק חשבון השירות של הייצור');
    const ci = w.split('name: קוד ההקמה עם הסודות')[1].split('- name:')[0];
    ok(['VERCEL_TOKEN', 'PROD_TUNNEL_TOKEN', 'PROD_APP_EXTRA'].every((k) => ci.includes(k + ': ${{ secrets.' + k + ' }}'))
      && /VERCEL_PROJECT: \$\{\{ vars\.VERCEL_PROJECT \}\}/.test(ci), 'workflow ת3: הסודות של השרתון מגיעים רק לצעד של קוד ההקמה');
    const src = read('tools/server-provision.js');
    /* 14/10/2026: הקמת snb-2 נעצרה ב"חסר חשבון השירות של Firebase" — מאז ת3 קוד ההקמה פותח את הכספת של הייצור
       ב־PROD_FIREBASE_SA, והצעד לא קיבל אותו. כל סוד STG_/PROD_ שהכלי קורא — בצעד של קוד ההקמה */
    const need = [...new Set(src.match(/\b(?:STG|PROD)_[A-Z0-9_]+\b/g))];
    const miss = need.filter((k) => !new RegExp('\\b' + k + '[A-Z0-9_]*: \\$\\{\\{ secrets\\.' + k).test(ci));
    ok(need.length >= 10 && !miss.length, 'workflow: כל סוד שהכלי קורא מגיע לצעד של קוד ההקמה' + (miss.length ? ' (חסרים: ' + miss.join(', ') + ')' : ''));
    ok(!/console\.(log|error)\([^)]*(token|E\.|e\.STG|HCLOUD)/.test(src), 'הכלי לא מדפיס סודות');
  }

  console.log('# ' + (n - bad) + ' בדיקות עברו' + (bad ? ', ' + bad + ' נכשלו' : ''));
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
void os;
