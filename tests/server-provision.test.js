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

    // ייצור: מחכים רק לעובד (השרתון ב־Vercel)
    const M4 = mock({ healthAfter: Infinity, seenAfter: 1_000_000 + 3 * 60e3 });
    const rp = await P.register(E, P.ENVS.prod, 'snb-1', M4.deps);
    const w4 = await P.waitUp(E, P.ENVS.prod, rp.sid, M4.deps);
    ok(w4.health && w4.seen > 0 && !M4.calls.some((c) => c.url.endsWith('/healthz')), 'all: ייצור — בלי healthz, רק העובד');

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
    const src = read('tools/server-provision.js');
    ok(!/console\.(log|error)\([^)]*(token|E\.|e\.STG|HCLOUD)/.test(src), 'הכלי לא מדפיס סודות');
  }

  console.log('# ' + (n - bad) + ' בדיקות עברו' + (bad ? ', ' + bad + ' נכשלו' : ''));
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
void os;
