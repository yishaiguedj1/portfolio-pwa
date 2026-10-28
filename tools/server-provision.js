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
 * מה מקימים (--plan): stg = חדרי הניסוי בלבד (Tunnel, השרתון והעובד של הניסוי);
 *                     all = שרת אחד לכל המערכת — גם העובד של הייצור (12/10/2026, האיחוד בתוכנית).
 * ת3 (12/10/2026): all מקים גם את השרתון של הייצור (חדר app + Tunnel משלו, api.thesnowball.app). הסודות שלו —
 * המשתנים של Vercel כמו שהם (vercelEnv, טוקן Vercel), כי חלקם חייבים להיות זהים בדיוק: מפתח הכספת נגזר מחשבון
 * השירות (lib/vault.js), ומפתח אחר = החיבורים השמורים (IBKR ברקע, Drive, ה־Routine, ההתראות) לא נפתחים.
 * העובד של הייצור ממשיך לדבר עם השרתון ב־Vercel (job.SERVER) עד שהמעבר יוכח. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const S = require(path.join(ROOT, 'ibkr-proxy/lib/studio.js'));

const ENVS = {
  stg: {
    project: 'snowball-staging-758f6',
    saVar: 'STG_FIREBASE_SA',
    api: 'https://api-staging.thesnowball.app',
    bucket: 'snb-staging',
    monthUsd: 3,
  },
  prod: {
    project: 'yishaiguedj1-c786e',
    saVar: 'PROD_FIREBASE_SA',
    api: 'https://api.thesnowball.app',       // ת3: השרתון של הייצור בשרת (Tunnel משלו). Vercel נשאר גיבוי
  },
};
/* מה כל תוכנית מקימה, ומה ברירת המחדל לשם ולגודל. ייצור + ניסוי באותו שרת = לפחות 16GB:
   העובד של הניסוי מקבל 45% מהזיכרון (3–6GB), השרתון וה־Tunnel כ־0.8GB, ושיא היישור תחת gVisor 4.2GB (snb_limits).
   16/10/2026: השרת המאוחד עבר ל־x86 (CX43, Intel/AMD) — ברירת המחדל כמוהו. התמונות עדיין נבנות גם ל־Arm (גיבוי כשאין מלאי). */
const PLANS = {
  stg: { envs: ['stg'], name: 'snb-stg-1', type: 'cax21', minGb: 4 },
  all: { envs: ['prod', 'stg'], name: 'snb-1', type: 'cx43', minGb: 15 },
};
/* ת3: משתני Vercel שלא עוברים לשרת — של Vercel עצמו, ומה שהשרת קובע בעצמו (compose) */
const VERCEL_API = 'https://api.vercel.com';
const ENV_SKIP = new Set(['SNB_CRON', 'SNB_CLIENT_IP_HEADER', 'SNB_ENV_GZ', 'PORT', 'NODE_ENV', 'TZ']);
const ENV_SKIP_RE = /^(VERCEL|NOW|TURBO|NX)_/;
const ENV_KEY_RE = /^[A-Z][A-Z0-9_]{1,60}$/;
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
  vercel: /^[A-Za-z0-9_-]{20,100}$/,
  vproject: /^[a-z0-9._-]{1,100}$/,
  vteam: /^team_[A-Za-z0-9]{10,40}$/,
  uid: /^[A-Za-z0-9]{10,128}$/,
  gclient: /^\d{6,20}-[a-z0-9]{20,40}\.apps\.googleusercontent\.com$/,   // לקוח OAuth של Google (גיבוי הספרייה / Drive של הסטודיו)
  gsecret: /^GOCSPX-[A-Za-z0-9_-]{20,40}$/,
  // 28/10/2026: IB Gateway (Paper). הסיסמה נכנסת לקובץ env של compose — בלי רווח, $, גרשיים, \, ` ו־# (compose מפרש אותם)
  ibuser: /^[A-Za-z0-9._-]{3,40}$/,
  ibpass: /^[A-Za-z0-9!%&()*+,./:;<=>?@\[\]^_{|}~-]{8,64}$/,
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

/* לקוח OAuth של Google לחדר הניסוי — רשות: שני הסודות יחד (‎<pre>_ID / <pre>_SECRET) או אף אחד; בלי — הגיבוי ל־Drive
   בניסוי לא מוגדר (gdConfig → configured:false), כמו עד 13/10/2026 */
function gdrivePair(e, pre, out, chk) {
  const id = String(e[pre + '_ID'] || '').trim(), sec = String(e[pre + '_SECRET'] || '').trim();
  if (!id && !sec) return [];
  return [out + '_ID=' + chk(() => need(RE.gclient, id, 'gclient_bad', pre + '_ID', { expect: 'מספר-מחרוזת.apps.googleusercontent.com' })),
    out + '_SECRET=' + chk(() => need(RE.gsecret, sec, 'gsecret_bad', pre + '_SECRET', { expect: 'מתחיל ב־GOCSPX-' }))];
}

/* קובצי הסודות של חדרי הניסוי — מחזיר [{path, lines}] */
/* errs (רשות) — אוסף משותף לכמה חדרים, כדי שכל הסודות השגויים ידווחו בהודעה אחת */
/* כל הסודות נבדקים, וכל מה שלא תקין מדווח יחד (12/10/2026: עצירה בבעיה הראשונה = ריצה לכל סוד שגוי) */
function stagingFiles(env, e, token, errs) {
  const own = !errs;
  errs = errs || [];
  const chk = (fn) => { try { return fn(); } catch (x) { errs.push(x.message); return ''; } };
  const sa = chk(() => saOf(e.STG_FIREBASE_SA, env.project));
  const admins = chk(() => emailsOf(e.STG_ADMIN_EMAIL));
  const v = (...a) => chk(() => need(...a));
  const files = [
    { path: '/etc/snb/tunnel.env', lines: ['TUNNEL_TOKEN=' + v(RE.tunnel, e.STG_TUNNEL_TOKEN, 'tunnel_bad', 'STG_TUNNEL_TOKEN', { expect: 'מחרוזת ארוכה שמתחילה ב־eyJ, בלי --token' })] },
    { path: '/etc/snb/app-stg.env', lines: [
      'FIREBASE_PROJECT_ID=' + env.project,
      'GDRIVE_SA_KEY=' + (sa ? Buffer.from(JSON.stringify(sa)).toString('base64') : ''),
      'R2_ACCOUNT_ID=' + v(RE.account, e.CLOUDFLARE_ACCOUNT_ID, 'account_bad', 'CLOUDFLARE_ACCOUNT_ID', { hex: 1, expect: '32 תווים, ספרות ו־a–f' }),
      'R2_ACCESS_KEY_ID=' + v(RE.r2id, e.STG_R2_ACCESS_KEY_ID, 'r2_bad', 'STG_R2_ACCESS_KEY_ID', { hex: 1, expect: '32 תווים, ספרות ו־a–f (Access Key ID)' }),
      'R2_SECRET_ACCESS_KEY=' + v(RE.r2secret, e.STG_R2_SECRET_ACCESS_KEY, 'r2_bad', 'STG_R2_SECRET_ACCESS_KEY', { hex: 1, expect: '64 תווים, ספרות ו־a–f (Secret Access Key)' }),
      'R2_BUCKET=' + env.bucket,
      'R2_JURISDICTION=eu',
      'LIBRARY_ADMINS=' + admins,
      'LIBRARY_READERS=' + admins,
      'STUDIO_USERS=' + admins,
      'IBKR_SYNC_USERS=' + admins,
      'STUDIO_API_USER_MONTH_USD=' + env.monthUsd,
      'CRON_SECRET=' + crypto.randomBytes(24).toString('hex'),
      ...gdrivePair(e, 'STG_GDRIVE_CLIENT', 'GDRIVE_CLIENT', chk),          // רשות (13/10/2026): גיבוי הספרייה ל־Drive בניסוי
      ...gdrivePair(e, 'STG_STUDIO_GDRIVE_CLIENT', 'STUDIO_GDRIVE_CLIENT', chk),   // רשות: Drive של הסטודיו בניסוי (לקוח נפרד — v357)
    ] },
    { path: '/etc/snb/worker-stg.env', lines: [
      'ANTHROPIC_API_KEY=' + v(RE.anthropic, e.STG_ANTHROPIC_KEY, 'anthropic_bad', 'STG_ANTHROPIC_KEY', { expect: 'מתחיל ב־sk-ant-' }),
      'SNB_WORKER_TOKEN=' + v(RE.token, token, 'token_bad', 'טוקן השרת'),
    ] },
  ];
  if (own) failErrs(errs);
  return files;
}

function failErrs(errs) {
  if (errs.length) fail(errs.length > 1 ? 'secrets_bad' : 'secret_bad', (errs.length > 1 ? errs.length + ' סודות לא תקינים' : 'סוד אחד לא תקין') + ':\n  • ' + errs.join('\n  • '));
}

/* ---------------------------------------------------------------- ת3: הסודות של השרתון מ־Vercel */
/* PROD_APP_EXTRA (רשות): שורות שם=ערך — למשתנה שמסומן Sensitive ב־Vercel (אי אפשר לקרוא אותו בחזרה),
   או להחלפת ערך. גובר על Vercel. */
function parseExtra(raw) {
  const out = {};
  const lines = String(raw || '').split(/\r?\n/);
  for (let n = 0; n < lines.length; n++) {
    const s = lines[n].trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    const k = i > 0 ? s.slice(0, i).trim() : '';
    if (!ENV_KEY_RE.test(k)) fail('extra_bad', 'שורה ב־PROD_APP_EXTRA בלי שם תקין (צפוי: שם=ערך, שם באותיות גדולות)');
    let v = s.slice(i + 1).trim();
    /* JSON שהודבק כמו שהוא (קובץ חשבון שירות — כמה שורות): מצרפים שורות עד שהוא נסגר, ושומרים בשורה אחת */
    if (v.startsWith('{')) {
      let m = n, j = null;
      for (;;) {
        try { j = JSON.parse(v); break; } catch (x) { /* עוד לא נסגר */ }
        if (++m >= lines.length) break;
        v += '\n' + lines[m];
      }
      if (j) { v = JSON.stringify(j); n = m; } else v = s.slice(i + 1).trim();
    }
    out[k] = v;
  }
  return out;
}

const inProd = (t) => (Array.isArray(t) ? t.includes('production') : t === 'production');

/* המשתנים של סביבת production בפרויקט ב־Vercel, עם הערכים — [{key, value|null, type}].
   ערך שלא חזר (Sensitive) = null. שום ערך לא מודפס. */
async function vercelEnv(e, deps) {
  const tok = String(e.VERCEL_TOKEN || '').trim();
  if (!RE.vercel.test(tok)) fail('vercel_token', 'חסר VERCEL_TOKEN (או לא בצורה הנכונה) — Vercel ← Account Settings ← Tokens');
  const proj = String(e.VERCEL_PROJECT || 'ibkr-proxy').trim();
  if (!RE.vproject.test(proj)) fail('vercel_project', 'שם הפרויקט ב־Vercel לא תקין (VERCEL_PROJECT)');
  const team = String(e.VERCEL_TEAM_ID || '').trim();
  if (team && !RE.vteam.test(team)) fail('vercel_team', 'VERCEL_TEAM_ID לא בצורה team_…');
  const q = team ? '&teamId=' + team : '';
  const get = async (p) => {
    const r = await deps.fetch(VERCEL_API + p, { headers: { Authorization: 'Bearer ' + tok } });
    let j = null;
    try { j = await r.json(); } catch (x) { /* ריק */ }
    if (r.status === 404) fail('vercel_project', 'אין ב־Vercel פרויקט בשם ' + proj + ' — להגדיר את שמו במשתנה VERCEL_PROJECT (Settings ← Variables)');
    if (r.status === 401 || r.status === 403) fail('vercel_auth', 'Vercel דחה את הטוקן (' + r.status + ') — טוקן שפג או בלי גישה לפרויקט');
    if (r.status !== 200 || !j) fail('vercel_http_' + r.status, 'Vercel החזיר ' + r.status);
    return j;
  };
  const j = await get('/v10/projects/' + encodeURIComponent(proj) + '/env?decrypt=true' + q);
  if (j.pagination && j.pagination.next) fail('vercel_page', 'יותר משתנים ממה שחוזר בעמוד אחד — לא נתמך');
  if (Number(j.hiddenProductionEnvCount) > 0) fail('vercel_hidden', j.hiddenProductionEnvCount + ' משתני ייצור מוסתרים מהטוקן — טוקן עם גישה מלאה לפרויקט');
  const out = [];
  for (const x of j.envs || []) {
    if (!x || !inProd(x.target) || x.gitBranch) continue;
    let value = typeof x.value === 'string' && x.decrypted !== false && x.type !== 'sensitive' ? x.value : null;
    if (value == null && x.type !== 'sensitive' && x.id && /^[A-Za-z0-9_-]{4,80}$/.test(x.id)) {
      const one = await get('/v1/projects/' + encodeURIComponent(proj) + '/env/' + x.id + '?' + q.slice(1));
      if (typeof one.value === 'string' && one.decrypted !== false) value = one.value;
    }
    out.push({ key: String(x.key || ''), value, type: String(x.type || '') });
  }
  return out;
}

/* מהרשימה של Vercel לשורה אחת: SNB_ENV_GZ = gzip+base64 של {שם: ערך} (server.js — unpackEnv פותח). כל ערך עובר
   כמו שהוא, גם עם רווחים, # או מירכאות. חסר ערך (Sensitive) ואין ב־PROD_APP_EXTRA — שגיאה עם השמות בלבד. */
/* 15/10/2026: מאגר הלמידה (R2L_*) — רשות. חסר אחד מהם (Sensitive ולא ב־PROD_APP_EXTRA) → השרת מוקם בלי אף אחד מהם
   (לא חצי הגדרה), עם SNB_LEARN_REMOTE=1: השרתון עונה 421 לפעולות של המאגר והטלפון שולח אותן ל־Vercel (api/studio.js).
   opt = השמות שחסרו — לאזהרה ב־Issue של ההזמנה */
const ENV_OPT_RE = /^R2L_/;
function appEnvLine(vars, extraRaw, project) {
  const zlib = require('zlib');
  const extra = parseExtra(extraRaw);
  const obj = {}, missing = [], opt = [];
  for (const x of vars) {
    if (!ENV_KEY_RE.test(x.key) || ENV_SKIP.has(x.key) || ENV_SKIP_RE.test(x.key)) continue;
    if (x.value == null) { if (!(x.key in extra)) (ENV_OPT_RE.test(x.key) ? opt : missing).push(x.key); continue; }
    obj[x.key] = x.value;
  }
  for (const [k, v] of Object.entries(extra)) if (!ENV_SKIP.has(k)) obj[k] = v;
  if (opt.length) {
    for (const k of Object.keys(obj)) if (ENV_OPT_RE.test(k)) delete obj[k];
    obj.SNB_LEARN_REMOTE = '1';
  }
  if (missing.length) fail('vercel_sensitive', missing.length + ' משתנים מסומנים Sensitive ב־Vercel ואי אפשר לקרוא אותם: '
    + missing.sort().join(', ') + ' — להוסיף אותם לסוד PROD_APP_EXTRA (שורה לכל אחד: שם=ערך)');
  /* חשבון השירות — חובה וזהה ל־Vercel: ממנו Firestore, ומפתח הכספת כשאין IBKR_VAULT_KEY */
  let sa = null;
  try { const raw = String(obj.GDRIVE_SA_KEY || '').trim(); sa = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')); } catch (x) { /* למטה */ }
  if (!sa || sa.type !== 'service_account' || !sa.private_key) fail('vercel_sa', 'ב־Vercel אין GDRIVE_SA_KEY תקין — השרתון לא יגיע ל־Firestore');
  if (obj.FIREBASE_PROJECT_ID && obj.FIREBASE_PROJECT_ID !== project) fail('vercel_project_id', 'FIREBASE_PROJECT_ID ב־Vercel שונה מ־' + project);
  const b64 = zlib.gzipSync(Buffer.from(JSON.stringify(obj)), { level: 9 }).toString('base64');
  return { line: 'SNB_ENV_GZ=' + b64, keys: Object.keys(obj).sort(), vault: obj.IBKR_VAULT_KEY ? 'e' : 's', opt: opt.sort() };
}

/* GDRIVE_SA_KEY מסומן Sensitive ב־Vercel (אי אפשר לקרוא אותו) — במקומו PROD_FIREBASE_SA, אבל רק אחרי הוכחה שזה
   אותו מפתח בדיוק: רשומה קיימת בכספת של הייצור נפתחת במפתח שנגזר ממנו. מפתח אחר של אותו חשבון שירות היה עובר מול
   Firestore, אבל כל מה שכבר מוצפן (IBKR, ה־Routine, Drive) לא היה נפתח בשרת. הרשומות שבודקים — כל אחת עם ה־AAD
   שלה, כמו בשרתון (api/studio.js, lib/gdrive.js, api/ibkr-sync.js); רשומה אחת שנפתחת מספיקה. אין אף רשומה = עצירה. */
const VAULT_PROBES = [
  { col: 'studioVault', field: 'vk', aad: () => 'webpush|vapid', id: '_vapid' },
  { col: 'studioVault', field: 'r', aad: (u) => 'studio|' + u + '|r' },
  { col: 'driveVault', field: 'r', aad: (u) => 'gdrive|' + u + '|r' },
  { col: 'studioDrive', field: 'r', aad: (u) => 'sdrive|' + u + '|r' },
  { col: 'ibkrVault', field: 'c', aad: (u) => u + '|c' },
];
async function saVerified(e, vars, deps, cand) {
  const env = ENVS.prod;
  /* cand = GDRIVE_SA_KEY מ־PROD_APP_EXTRA: נבדק באותה דרך — קובץ לא נכון לא עובר בשקט. בלי cand — PROD_FIREBASE_SA */
  let csa = null;
  if (cand != null) {
    try { const t = String(cand).trim(); csa = JSON.parse(t.startsWith('{') ? t : Buffer.from(t, 'base64').toString('utf8')); } catch (x) { /* למטה */ }
    if (!csa || csa.type !== 'service_account' || !csa.client_email || !csa.private_key) fail('extra_sa_bad', 'GDRIVE_SA_KEY ב־PROD_APP_EXTRA הוא לא מפתח של חשבון שירות (צפוי JSON עם "type": "service_account")');
  }
  const raw = Buffer.from(JSON.stringify(csa || saOf(e[env.saVar], env.project))).toString('base64');
  const tok = await fsToken(e, env, deps);
  const sealed = [];
  for (const col of [...new Set(VAULT_PROBES.map((p) => p.col))]) {
    const r = await deps.fetch(fsBase(env.project) + '/' + col + '?pageSize=5', { headers: { Authorization: 'Bearer ' + tok } });
    if (r.status !== 200) continue;
    let docs = [];
    try { docs = (await r.json()).documents || []; } catch (x) { /* ריק */ }
    for (const d of docs) {
      const id = String(d.name || '').split('/').pop();
      for (const p of VAULT_PROBES) {
        if (p.col !== col || (p.id && p.id !== id) || (!p.id && id.startsWith('_'))) continue;
        const v = String(((d.fields || {})[p.field] || {}).stringValue || '');
        if (v) sealed.push({ v, aad: p.aad(id) });
      }
    }
  }
  if (!sealed.length && csa) return raw;   // אין מה לפתוח — אין מה לשבור
  if (!sealed.length) fail('sa_unverified', 'GDRIVE_SA_KEY מסומן Sensitive ב־Vercel, ואין בכספת של הייצור רשומה לבדוק מולה את PROD_FIREBASE_SA — להוסיף את GDRIVE_SA_KEY ל־PROD_APP_EXTRA');
  const extra = parseExtra(e.PROD_APP_EXTRA);
  const ev = vars.find((x) => x.key === 'IBKR_VAULT_KEY');
  const evk = 'IBKR_VAULT_KEY' in extra ? extra.IBKR_VAULT_KEY : (ev && ev.value) || '';
  if (!evk && sealed.every((x) => x.v.split('.')[1] === 'e')) fail('vault_key_missing', 'הכספת מוצפנת ב־IBKR_VAULT_KEY, והוא מסומן Sensitive ב־Vercel — להוסיף אותו ל־PROD_APP_EXTRA');
  const prev = process.env.IBKR_VAULT_KEY, prevSa = process.env.GDRIVE_SA_KEY;
  process.env.IBKR_VAULT_KEY = evk;
  process.env.GDRIVE_SA_KEY = raw;
  let opened = false;
  try {
    const V = require(path.join(ROOT, 'ibkr-proxy/lib/vault.js'));
    opened = sealed.some((x) => V.open(x.v, x.aad) != null);
  } finally {
    if (prev === undefined) delete process.env.IBKR_VAULT_KEY; else process.env.IBKR_VAULT_KEY = prev;
    if (prevSa === undefined) delete process.env.GDRIVE_SA_KEY; else process.env.GDRIVE_SA_KEY = prevSa;
  }
  if (!opened && csa) fail('extra_sa_mismatch', 'GDRIVE_SA_KEY ב־PROD_APP_EXTRA לא פותח את הכספת — זה לא המפתח שב־Vercel');
  if (!opened) fail('sa_mismatch', 'PROD_FIREBASE_SA הוא לא אותו מפתח שב־Vercel (הכספת לא נפתחת בו) — להוסיף ל־PROD_APP_EXTRA את GDRIVE_SA_KEY המקורי, JSON בשורה אחת או base64');
  return raw;
}

/* המשתנים של השרתון — Vercel, עם חשבון השירות מ־GitHub כשהוא Sensitive ואומת (saVerified).
   sa = 'g' מ־PROD_FIREBASE_SA, ‏'x' מ־PROD_APP_EXTRA (גם הוא אומת מול הכספת), 'v' מ־Vercel */
async function appEnv(e, deps) {
  const vars = await vercelEnv(e, deps);
  const x = vars.find((v) => v.key === 'GDRIVE_SA_KEY');
  const extra = parseExtra(e.PROD_APP_EXTRA);
  let sa = 'v';
  if (x && x.value == null) {
    if ('GDRIVE_SA_KEY' in extra) { await saVerified(e, vars, deps, extra.GDRIVE_SA_KEY); sa = 'x'; }
    else { x.value = await saVerified(e, vars, deps); sa = 'g'; }
  }
  return Object.assign(appEnvLine(vars, e.PROD_APP_EXTRA, ENVS.prod.project), { sa });
}

/* החדרים של הייצור: העובד (worker.env) — אותו מבנה שהאפליקציה כותבת ב"הוספת שרת" (cloudInitWithSecrets);
   ומ־ת3, כשיש appLine: השרתון (app.env) וה־Tunnel שלו (tunnel-prod.env) */
function prodFiles(e, token, errs, appLine) {
  const own = !errs;
  errs = errs || [];
  const v = (...a) => { try { return need(...a); } catch (x) { errs.push(x.message); return ''; } };
  const files = [{ path: '/etc/snb/worker.env', lines: [
    'ANTHROPIC_API_KEY=' + v(RE.anthropic, e.PROD_ANTHROPIC_KEY, 'anthropic_bad', 'PROD_ANTHROPIC_KEY', { expect: 'מתחיל ב־sk-ant-' }),
    'SNB_WORKER_TOKEN=' + v(RE.token, token, 'token_bad', 'טוקן השרת של הייצור'),
  ] }];
  if (appLine) {
    files.push({ path: '/etc/snb/tunnel-prod.env', lines: ['TUNNEL_TOKEN=' + v(RE.tunnel, e.PROD_TUNNEL_TOKEN, 'tunnel_bad', 'PROD_TUNNEL_TOKEN', { expect: 'מחרוזת ארוכה שמתחילה ב־eyJ, בלי --token' })] });
    files.push({ path: '/etc/snb/app.env', lines: [appLine] });
    const gw = ibgwFile(e, errs);
    if (gw) files.push(gw);
    if (e.PROD_TUNNEL_TOKEN && e.PROD_TUNNEL_TOKEN === e.STG_TUNNEL_TOKEN) errs.push('PROD_TUNNEL_TOKEN זהה ל־STG_TUNNEL_TOKEN — לייצור Tunnel נפרד (snb-prod)');
  }
  if (own) failErrs(errs);
  return files;
}

/* 28/10/2026: IB Gateway — שלב 1 במחקר המסחר (Paper, ‏Read-Only; infra/compose.ibgw.yaml). שני סודות GitHub:
   IBGW_PAPER_USER, ‏IBGW_PAPER_PASS ("THE SNOWBALL IBKR Gateway paper"). אין אף אחד — אין חדר (null). רק אחד / לא תקין — שגיאה */
function ibgwFile(e, errs) {
  const u = String(e.IBGW_PAPER_USER || '').trim(), p = String(e.IBGW_PAPER_PASS || '');
  if (!u && !p) return null;
  const v = (...a) => { try { return need(...a); } catch (x) { errs.push(x.message); return ''; } };
  const lines = ['TWS_USERID=' + v(RE.ibuser, u, 'ibgw_user_bad', 'IBGW_PAPER_USER', { expect: 'שם המשתמש של חשבון ה־Paper' }),
    'TWS_PASSWORD=' + v(RE.ibpass, p, 'ibgw_pass_bad', 'IBGW_PAPER_PASS', { expect: '8–64 תווים, בלי רווח ובלי $ \' " ` \\ #' })];
  return { path: '/etc/snb/ibgw.env', lines };
}

/* כל קובצי הסודות של התוכנית — tokens = {prod, stg}; appLine = השורה של השרתון של הייצור (appEnvLine) */
function planFiles(plan, e, tokens, appLine) {
  const P = PLANS[plan];
  if (!P) fail('plan', 'תוכנית לא מוכרת');
  const errs = [], files = [];
  if (P.envs.includes('prod')) files.push(...prodFiles(e, tokens.prod, errs, appLine));
  if (P.envs.includes('stg')) files.push(...stagingFiles(ENVS.stg, e, tokens.stg, errs));
  failErrs(errs);
  return files;
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
  process.env.GDRIVE_SA_KEY = Buffer.from(JSON.stringify(saOf(e[env.saVar], env.project))).toString('base64');
  const G = require(path.join(ROOT, 'ibkr-proxy/lib/gauth.js'));
  return G.datastoreToken(deps.fetch);
}

async function register(e, env, name, deps) {
  const tok = await fsToken(e, env, deps);
  const sid = S.newServerId(), token = S.newServerToken(sid), now = deps.now();
  /* by = המנהל (sysBackup/cfg — נרשם כשהוא פותח את הסטודיו), כדי שהתראת "השרת נפל" תגיע אליו.
     לא נמצא — ריק (השרת עובד, רק בלי ההתראה). */
  let by = '';
  try {
    const c = await deps.fetch(fsBase(env.project) + '/sysBackup/cfg', { headers: { Authorization: 'Bearer ' + tok } });
    if (c.status === 200) { const u = String((((await c.json()).fields || {}).uid || {}).stringValue || ''); if (RE.uid.test(u)) by = u; }
  } catch (x) { /* בלי בעלים */ }
  const r = await deps.fetch(fsBase(env.project) + '/studioServers/' + sid + '?currentDocument.exists=false', {
    method: 'PATCH', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: S.toFields({ th: S.keyHash(token), name, created: now, seen: 0, paused: false, job: '', by, updated: now }) }),
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
  if (r.status >= 300) {
    const hcode = j && j.error ? String(j.error.code).slice(0, 40) : '';
    try { fail('hcloud_' + r.status, 'Hetzner החזיר ' + r.status + (hcode ? ' · ' + hcode : '')); } catch (x) { x.hcode = hcode; throw x; }
  }
  return j || {};
}

async function create(e, opts, userData, deps) {
  if (!/^[A-Za-z0-9]{20,100}$/.test(String(e.HCLOUD_TOKEN || ''))) fail('hcloud_token', 'חסר HCLOUD_TOKEN');
  if (!NAME_RE.test(opts.name) || !TYPE_RE.test(opts.type) || !LOC_RE.test(opts.location)) fail('opts', 'שם/סוג/מיקום לא תקינים');
  const plan = PLANS[opts.plan || 'stg'];
  if (!plan) fail('plan', 'תוכנית לא מוכרת');
  const st = ((await hc(deps, e, 'GET', '/server_types?name=' + encodeURIComponent(opts.type))).server_types || [])[0];
  if (!st) fail('type', 'אין ב־Hetzner סוג שרת בשם ' + opts.type);
  if (Number(st.memory) < plan.minGb) fail('too_small', opts.type + ' עם ' + st.memory + 'GB קטן מדי — צריך לפחות ' + Math.ceil(plan.minGb) + 'GB (למשל ' + plan.type + ')');
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
    labels: { snb: opts.plan || 'stg', by: 'github' },
  });
  return { id: j.server && j.server.id, name: opts.name };
}

async function waitUp(e, env, sid, deps, limits = {}) {
  const t0 = deps.now(), every = limits.every || 20e3;
  const healthBy = t0 + (limits.health || 20 * 60e3), seenBy = t0 + (limits.seen || 45 * 60e3);
  let health = !env.api, seen = 0;
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
  const plan = String(a.plan || 'stg');
  if (!PLANS[plan]) fail('plan', 'תוכנית לא מוכרת');
  const name = String(a.name || '') || PLANS[plan].name;
  if (cmd === 'defaults') {                   // שורות ל־GITHUB_OUTPUT — רק ערכים בצורה קשיחה (בלי שורות חדשות)
    const type = String(a.type || '') || PLANS[plan].type;
    if (!NAME_RE.test(name) || !TYPE_RE.test(type)) fail('opts', 'שם/סוג לא תקינים');
    return 'name=' + name + '\ntype=' + type;
  }
  if (cmd === 'register') {
    if (!NAME_RE.test(name)) fail('opts', 'שם לא תקין');
    const r = await register(e, env, name, deps);
    fs.writeFileSync(a.out, r.token + '\n', { mode: 0o600 });
    return 'sid=' + r.sid;
  }
  if (cmd === 'cloud-init') {
    const rd = (f) => (f && fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : '');
    /* ת3: בתוכנית עם הייצור — גם השרתון של הייצור, מהמשתנים של Vercel */
    let app = null;
    if (PLANS[plan].envs.includes('prod')) app = await appEnv(e, deps);
    const out = cloudInit(fs.readFileSync(path.join(ROOT, 'infra/cloud-init.yaml'), 'utf8'),
      planFiles(plan, e, { stg: rd(a.token), prod: rd(a['token-prod']) }, app && app.line));
    fs.writeFileSync(a.out, out, { mode: 0o600 });
    /* רק שמות — בלי ערכים. vault: e = IBKR_VAULT_KEY, s = נגזר מחשבון השירות */
    return 'bytes=' + Buffer.byteLength(out) + (app ? '\nvercel=' + app.keys.length + ' משתנים (' + app.keys.join(' ') + ') · vault=' + app.vault + ' · sa=' + app.sa : '');
  }
  if (cmd === 'create') {
    const r = await create(e, { name, type: String(a.type || '') || PLANS[plan].type, location: String(a.location || ''), plan },
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

module.exports = { ENVS, PLANS, RE, shape, need, saOf, emailsOf, stagingFiles, prodFiles, ibgwFile, planFiles, cloudInit, vercelEnv, appEnvLine, appEnv, saVerified, parseExtra, hc, NAME_RE, TYPE_RE, LOC_RE, fsBase, fsToken, register, unregister, create, waitUp, main, MARK };
