#!/usr/bin/env node
/* "הקמת שרת" מ־GitHub Actions (שלב 2ב, 12/10/2026 — תוכנית העמידות: מה שמקים את השרת חי מחוץ לו).
 *
 * workflow ‏server.yml קורא לפקודות לפי הסדר:
 *   register  — טוקן שרת חדש, וה־hash שלו נרשם ב־Firestore של הסביבה (studioServers/{sid}) דרך חשבון השירות.
 *               בלי השרתון — הוא עוד לא קיים (הוא בדיוק מה שהשרת החדש יריץ). הטוקן נכתב לקובץ בלבד.
 *   cloud-init — קוד ההקמה מהריפו + קובצי הסודות של החדרים (/etc/snb/*.env, ‏0600) במקום שורת הסימון.
 *               כל ערך נבדק בצורה קשיחה (בלי שורות חדשות / גרשיים) — אין הזרקת YAML ואין ערך שבור בשרת.
 *   create    — השרת ב־Hetzner (API), עם חומת האש snb-closed בלי אף כלל נכנס. שם קיים = עוצרים (לא דורסים).
 *   wait      — השרתון עונה דרך ה־Tunnel (healthz), ואז העובד מתחבר (seen ב־Firestore).
 *   unregister — ניקוי כשהיצירה נכשלה.
 *
 * הסודות מגיעים ממשתני הסביבה של ה־job (GitHub Secrets), לא מודפסים, ולא נכתבים לקבצים בריפו.
 * הסביבה היחידה כרגע: stg (הניסוי). ייצור — כשחדר האפליקציה של הייצור יעבור לשרת. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const S = require(path.join(ROOT, 'ibkr-proxy/lib/studio.js'));

const ENVS = {
  stg: {
    project: 'snowball-staging-758f6',
    api: 'https://api-staging.thesnowball.app',
    bucket: 'snb-staging',
    monthUsd: 3,
  },
};
const HCLOUD = 'https://api.hetzner.cloud/v1';
const UD_MAX = 32 * 1024;                     // Hetzner: user-data עד 32KB
const MARK = '  # SNB_SECRETS';
const NAME_RE = /^[a-z][a-z0-9-]{2,40}$/;
const TYPE_RE = /^c[a-z]{1,3}\d{1,3}$/;      // cax21, cx43, cpx31 …
const LOC_RE = /^[a-z]{3}\d$/;               // nbg1, fsn1, hel1

const RE = {
  tunnel: /^[A-Za-z0-9+/=_-]{80,2000}$/,
  r2id: /^[0-9a-f]{32}$/,
  r2secret: /^[0-9a-f]{64}$/,
  account: /^[0-9a-f]{32}$/,
  anthropic: /^sk-ant-[A-Za-z0-9_-]{20,300}$/,
  email: /^[^\s@,;"'<>]+@[^\s@,;"'<>]+\.[a-z]{2,}$/i,
  token: /^[a-z0-9]{12}-[A-Za-z0-9_-]{43}$/,
};

function fail(code, msg) { const e = new Error(msg || code); e.code = code; throw e; }

/* חשבון השירות: JSON או base64, ורק של הפרויקט של הסביבה — חשבון של הייצור בסביבת הניסוי = עצירה */
function saOf(raw, project) {
  raw = String(raw || '').trim();
  if (!raw) fail('sa_missing', 'חסר חשבון השירות של Firebase');
  if (!raw.startsWith('{')) raw = Buffer.from(raw, 'base64').toString('utf8');
  let sa;
  try { sa = JSON.parse(raw); } catch (e) { fail('sa_bad', 'חשבון השירות לא JSON תקין'); }
  if (sa.type !== 'service_account' || !sa.client_email || !sa.private_key) fail('sa_bad', 'זה לא מפתח של חשבון שירות');
  if (sa.project_id !== project) fail('sa_project', 'חשבון השירות שייך לפרויקט אחר (' + String(sa.project_id).slice(0, 40) + ') — צריך את ' + project);
  return sa;
}

function emailsOf(raw) {
  const list = String(raw || '').split(/[\s,;]+/).filter(Boolean);
  if (!list.length || list.length > 5 || !list.every((e) => RE.email.test(e))) fail('admin_bad', 'מייל המנהל לא תקין');
  return list.map((e) => e.toLowerCase()).join(',');
}

/* צורת הערך בלי הערך עצמו — כמה תווים ומאילו סוגים. כך אפשר לדעת מה הודבק בטעות (ערך אחר מהמסך,
   מירכאות, רווח) בלי שהסוד יופיע ביומן של GitHub. */
function shape(v) {
  const kinds = [];
  if (/[0-9]/.test(v)) kinds.push('ספרות');
  if (/[a-f]/.test(v)) kinds.push('a–f');
  if (/[g-z]/.test(v)) kinds.push('אותיות קטנות מעבר ל־f');
  if (/[A-Z]/.test(v)) kinds.push('אותיות גדולות');
  if (/\s/.test(v)) kinds.push('רווחים או שורות');
  if (/[^0-9A-Za-z\s]/.test(v)) kinds.push('סימנים');
  return v.length + ' תווים' + (kinds.length ? ' (' + kinds.join(', ') + ')' : '');
}
/* hex: מפתחות R2 ומזהה החשבון — אותיות גדולות ורווחים שנכנסו בהדבקה לא מפילים. expect = מה מצופה, להודעה */
function need(re, v, code, label, opts = {}) {
  const raw = String(v || '');
  v = opts.hex ? raw.replace(/\s+/g, '').toLowerCase() : raw.trim();
  if (!re.test(v)) fail(code, label + ' חסר או לא בצורה הנכונה — התקבלו ' + shape(raw.trim()) + (opts.expect ? '; צפוי: ' + opts.expect : ''));
  return v;
}

/* קובצי הסודות של חדרי הניסוי — מחזיר [{path, lines}] */
function stagingFiles(env, e, token) {
  const sa = saOf(e.STG_FIREBASE_SA, env.project);
  const admins = emailsOf(e.STG_ADMIN_EMAIL);
  return [
    { path: '/etc/snb/tunnel.env', lines: ['TUNNEL_TOKEN=' + need(RE.tunnel, e.STG_TUNNEL_TOKEN, 'tunnel_bad', 'STG_TUNNEL_TOKEN', { expect: 'מחרוזת ארוכה שמתחילה ב־eyJ, בלי --token' })] },
    { path: '/etc/snb/app-stg.env', lines: [
      'FIREBASE_PROJECT_ID=' + env.project,
      'GDRIVE_SA_KEY=' + Buffer.from(JSON.stringify(sa)).toString('base64'),
      'R2_ACCOUNT_ID=' + need(RE.account, e.CLOUDFLARE_ACCOUNT_ID, 'account_bad', 'CLOUDFLARE_ACCOUNT_ID', { hex: 1, expect: '32 תווים, ספרות ו־a–f' }),
      'R2_ACCESS_KEY_ID=' + need(RE.r2id, e.STG_R2_ACCESS_KEY_ID, 'r2_bad', 'STG_R2_ACCESS_KEY_ID', { hex: 1, expect: '32 תווים, ספרות ו־a–f (Access Key ID)' }),
      'R2_SECRET_ACCESS_KEY=' + need(RE.r2secret, e.STG_R2_SECRET_ACCESS_KEY, 'r2_bad', 'STG_R2_SECRET_ACCESS_KEY', { hex: 1, expect: '64 תווים, ספרות ו־a–f (Secret Access Key)' }),
      'R2_BUCKET=' + env.bucket,
      'R2_JURISDICTION=eu',
      'LIBRARY_ADMINS=' + admins,
      'LIBRARY_READERS=' + admins,
      'STUDIO_USERS=' + admins,
      'IBKR_SYNC_USERS=' + admins,
      'STUDIO_API_USER_MONTH_USD=' + env.monthUsd,
      'CRON_SECRET=' + crypto.randomBytes(24).toString('hex'),
    ] },
    { path: '/etc/snb/worker-stg.env', lines: [
      'ANTHROPIC_API_KEY=' + need(RE.anthropic, e.STG_ANTHROPIC_KEY, 'anthropic_bad', 'STG_ANTHROPIC_KEY', { expect: 'מתחיל ב־sk-ant-' }),
      'SNB_WORKER_TOKEN=' + need(RE.token, token, 'token_bad', 'טוקן השרת'),
    ] },
  ];
}

function cloudInit(tpl, files) {
  if (!tpl.startsWith('#cloud-config') || tpl.split(MARK + '\n').length !== 2) fail('tpl', 'קוד ההקמה בריפו בלי שורת הסימון');
  const block = files.map((f) => {
    for (const ln of f.lines) if (!/^[A-Z][A-Z0-9_]{1,40}=[\x21-\x7e]+$/.test(ln)) fail('value_bad', 'ערך לא תקין ב־' + f.path);
    return '  - path: ' + f.path + '\n    permissions: "0600"\n    owner: root:root\n    content: |\n'
      + f.lines.map((l) => '      ' + l + '\n').join('');
  }).join('');
  const out = tpl.replace(MARK + '\n', block);
  if (Buffer.byteLength(out) > UD_MAX) fail('too_big', 'קוד ההקמה גדול מ־32KB (' + Buffer.byteLength(out) + ')');
  return out;
}

/* ---------------------------------------------------------------- Firestore (חשבון השירות של הסביבה) */
function fsBase(project) { return 'https://firestore.googleapis.com/v1/projects/' + project + '/databases/(default)/documents'; }
async function fsToken(e, env, deps) {
  process.env.GDRIVE_SA_KEY = Buffer.from(JSON.stringify(saOf(e.STG_FIREBASE_SA, env.project))).toString('base64');
  const G = require(path.join(ROOT, 'ibkr-proxy/lib/gauth.js'));
  return G.datastoreToken(deps.fetch);
}

async function register(e, env, name, deps) {
  const tok = await fsToken(e, env, deps);
  const sid = S.newServerId(), token = S.newServerToken(sid), now = deps.now();
  const r = await deps.fetch(fsBase(env.project) + '/studioServers/' + sid + '?currentDocument.exists=false', {
    method: 'PATCH', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: S.toFields({ th: S.keyHash(token), name, created: now, seen: 0, paused: false, job: '', by: '', updated: now }) }),
  });
  if (r.status !== 200) fail('fs_http_' + r.status, 'הרישום ב־Firestore נכשל (' + r.status + ')');
  return { sid, token };
}

async function unregister(e, env, sid, deps) {
  if (!S.SRV_ID_RE.test(String(sid || ''))) return false;
  const tok = await fsToken(e, env, deps);
  const r = await deps.fetch(fsBase(env.project) + '/studioServers/' + sid, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } });
  return r.status === 200 || r.status === 404;
}

/* ---------------------------------------------------------------- Hetzner */
async function hc(deps, e, method, p, body) {
  const r = await deps.fetch(HCLOUD + p, {
    method, headers: { Authorization: 'Bearer ' + e.HCLOUD_TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try { j = await r.json(); } catch (x) { /* ריק */ }
  if (r.status >= 300) fail('hcloud_' + r.status, 'Hetzner החזיר ' + r.status + (j && j.error ? ' · ' + String(j.error.code).slice(0, 40) : ''));
  return j || {};
}

async function create(e, opts, userData, deps) {
  if (!/^[A-Za-z0-9]{20,100}$/.test(String(e.HCLOUD_TOKEN || ''))) fail('hcloud_token', 'חסר HCLOUD_TOKEN');
  if (!NAME_RE.test(opts.name) || !TYPE_RE.test(opts.type) || !LOC_RE.test(opts.location)) fail('opts', 'שם/סוג/מיקום לא תקינים');
  const ex = await hc(deps, e, 'GET', '/servers?name=' + encodeURIComponent(opts.name));
  if ((ex.servers || []).length) fail('exists', 'כבר יש שרת בשם ' + opts.name + ' — מוחקים אותו ב־Hetzner או בוחרים שם אחר');
  let fw = ((await hc(deps, e, 'GET', '/firewalls?name=snb-closed')).firewalls || [])[0];
  if (fw && (fw.rules || []).some((x) => x.direction === 'in')) fail('fw_open', 'בחומת האש snb-closed יש כלל נכנס — היא אמורה להיות סגורה');
  if (!fw) fw = (await hc(deps, e, 'POST', '/firewalls', { name: 'snb-closed', rules: [] })).firewall;
  const j = await hc(deps, e, 'POST', '/servers', {
    name: opts.name, server_type: opts.type, location: opts.location, image: 'debian-13',
    user_data: userData, start_after_create: true,
    firewalls: [{ firewall: fw.id }],
    public_net: { enable_ipv4: true, enable_ipv6: true },
    labels: { snb: opts.env, by: 'github' },
  });
  return { id: j.server && j.server.id, name: opts.name };
}

async function waitUp(e, env, sid, deps, limits = {}) {
  const t0 = deps.now(), every = limits.every || 20e3;
  const healthBy = t0 + (limits.health || 20 * 60e3), seenBy = t0 + (limits.seen || 45 * 60e3);
  let health = false, seen = 0;
  while (!health && deps.now() < healthBy) {
    try {
      const r = await deps.fetch(env.api + '/healthz', { cache: 'no-store' });
      health = r.status === 200 && (await r.text()).trim() === 'ok';
    } catch (x) { /* עוד לא */ }
    if (!health) await deps.sleep(every);
  }
  if (!health) return { health, seen };
  const tok = await fsToken(e, env, deps);
  while (!seen && deps.now() < seenBy) {
    const r = await deps.fetch(fsBase(env.project) + '/studioServers/' + sid, { headers: { Authorization: 'Bearer ' + tok } });
    if (r.status === 200) {
      const f = ((await r.json()).fields || {}).seen || {};
      seen = Number(f.integerValue || f.doubleValue || 0);
    }
    if (!seen) await deps.sleep(every);
  }
  return { health, seen };
}

/* ---------------------------------------------------------------- CLI */
function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[i + 1], i++;
    else o._.push(argv[i]);
  }
  return o;
}

async function main(argv, e, deps) {
  const a = args(argv), cmd = a._[0];
  const env = ENVS[a.env || 'stg'];
  if (!env) fail('env', 'סביבה לא מוכרת');
  if (cmd === 'register') {
    const name = String(a.name || '');
    if (!NAME_RE.test(name)) fail('opts', 'שם לא תקין');
    const r = await register(e, env, name, deps);
    fs.writeFileSync(a.out, r.token + '\n', { mode: 0o600 });
    return 'sid=' + r.sid;
  }
  if (cmd === 'cloud-init') {
    const token = fs.readFileSync(a.token, 'utf8').trim();
    const out = cloudInit(fs.readFileSync(path.join(ROOT, 'infra/cloud-init.yaml'), 'utf8'), stagingFiles(env, e, token));
    fs.writeFileSync(a.out, out, { mode: 0o600 });
    return 'bytes=' + Buffer.byteLength(out);
  }
  if (cmd === 'create') {
    const r = await create(e, { name: String(a.name || ''), type: String(a.type || ''), location: String(a.location || ''), env: a.env || 'stg' },
      fs.readFileSync(a['user-data'], 'utf8'), deps);
    return 'server=' + r.id;
  }
  if (cmd === 'wait') {
    const r = await waitUp(e, env, String(a.sid || ''), deps);
    if (!r.health) fail('no_health', 'השרתון לא ענה דרך ה־Tunnel תוך 20 דקות (' + env.api + '/healthz)');
    if (!r.seen) fail('no_worker', 'השרתון עונה, אבל העובד לא התחבר תוך 45 דקות');
    return 'ok';
  }
  if (cmd === 'unregister') return 'removed=' + (await unregister(e, env, a.sid, deps));
  fail('cmd', 'פקודה לא מוכרת');
}

if (require.main === module) {
  const deps = { fetch: (...x) => fetch(...x), now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };
  main(process.argv.slice(2), process.env, deps).then((out) => { console.log('✓ ' + out); }, (err) => {
    console.error('✗ ' + (err.message || err.code));   // רק ההודעה שלנו — בלי ערכים
    process.exit(1);
  });
}

module.exports = { ENVS, RE, shape, need, saOf, emailsOf, stagingFiles, cloudInit, register, unregister, create, waitUp, main, MARK };
