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
};

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
    const fsCall = M.calls.find((c) => c.url.includes('firestore'));
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
    ok(/if: always\(\)\n\s+run: rm -f "\$RUNNER_TEMP\/ud" "\$RUNNER_TEMP\/tok"/.test(w), 'workflow: הקבצים עם הסודות נמחקים תמיד');
    const src = read('tools/server-provision.js');
    ok(!/console\.(log|error)\([^)]*(token|E\.|e\.STG|HCLOUD)/.test(src), 'הכלי לא מדפיס סודות');
  }

  console.log('# ' + (n - bad) + ' בדיקות עברו' + (bad ? ', ' + bad + ' נכשלו' : ''));
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
void os;
