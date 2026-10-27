'use strict';
/* השרתון כשרת HTTP רגיל (ת3 בתוכנית השרת המאוחד, 10/10/2026 — הכנה; טרם בשימוש).

   אותן פונקציות בדיוק שרצות היום ב־Vercel (api/*.js) — בלי שינוי בהן: המתאם הזה נותן להן את מה ש־Vercel נותן
   (req.body לפי Content-Type, req.query, res.status/json/send), את מגבלת הזמן של כל פונקציה מ־vercel.json, ואת
   הקרון היומי (crons ב־vercel.json). כך המעבר מ־Vercel הוא החלפת כתובת, לא שכתוב — ו־Vercel נשאר גיבוי.

   רץ בקונטיינר בלי הרשאות מאחורי השער (Caddy או Cloudflare Tunnel) — לא חשוף לאינטרנט ישירות:
     PORT (3000) · SNB_CLIENT_IP_HEADER (למשל cf-connecting-ip — הכתובת האמיתית מהשער) · SNB_CRON=on (הקרון;
     כבוי כברירת מחדל — בזמן המעבר Vercel עוד מריץ אותו) · CRON_SECRET (כמו ב־Vercel).
*/
const http = require('http');
const fs = require('fs');
const path = require('path');

/* הסודות של השרתון בייצור (ת3, 12/10/2026): הקמת השרת מעתיקה את משתני Vercel לשורה אחת ב־/etc/snb/app.env —
   SNB_ENV_GZ = gzip+base64 של {שם: ערך}. כך ערך עם רווח, #, $ או מירכאות עובר כמו שהוא (קובץ env של compose
   מפרש תווים כאלה), וכל הסודות נכנסים ב־32KB של Hetzner. מה שכבר מוגדר בסביבה (compose) גובר. */
const ENV_KEY_RE = /^[A-Z][A-Z0-9_]{1,60}$/;
function unpackEnv(env) {
  const raw = env.SNB_ENV_GZ;
  if (!raw) return 0;
  delete env.SNB_ENV_GZ;
  let obj;
  try { obj = JSON.parse(require('zlib').gunzipSync(Buffer.from(raw, 'base64')).toString('utf8')); } catch (e) { return -1; }
  let n = 0;
  for (const [k, v] of Object.entries(obj || {})) {
    if (!ENV_KEY_RE.test(k) || typeof v !== 'string' || env[k] != null) continue;
    env[k] = v; n++;
  }
  return n;
}

const MAX_BODY = 4.5 * 1024 * 1024;           // כמו Vercel (4.5MB); כל פונקציה בודקת מגבלה משלה
const DEF_DURATION = 10;                       // כמו Vercel Hobby כשלא הוגדר

function loadConfig(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'vercel.json'), 'utf8')); } catch (e) { return {}; }
}

function maxDuration(cfg, name) {
  const f = (cfg.functions || {})['api/' + name + '.js'];
  return f && f.maxDuration > 0 ? f.maxDuration : DEF_DURATION;
}

/* הוספת העזרים של Vercel ל־ServerResponse */
function decorate(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(o));
    return res;
  };
  res.send = (b) => {
    if (Buffer.isBuffer(b) || b instanceof Uint8Array) {
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/octet-stream');
      res.end(b);
    } else if (b && typeof b === 'object') res.json(b);
    else {
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(b == null ? '' : String(b));
    }
    return res;
  };
  return res;
}

/* req.body כמו ב־Vercel: JSON → אובייקט (לא תקין → המחרוזת, הפונקציות מטפלות), טקסט → מחרוזת,
   טופס → אובייקט, אחר → Buffer, בלי גוף → undefined */
function parseBody(buf, type) {
  if (!buf || !buf.length) return undefined;
  const t = String(type || '').split(';')[0].trim().toLowerCase();
  const s = () => buf.toString('utf8');
  if (t === 'application/json' || t.endsWith('+json')) { try { return JSON.parse(s()); } catch (e) { return s(); } }
  if (t.startsWith('text/')) return s();
  if (t === 'application/x-www-form-urlencoded') return Object.fromEntries(new URLSearchParams(s()));
  return buf;
}

function queryOf(url) {
  // שם פרמטר מהכתובת לא נכתב כשם שדה באובייקט (CodeQL: remote property injection) — קודם Map, ואז fromEntries
  // (יוצר שדות "רגילים" בלי setter של prototype). מפתחות מסוכנים — בכלל לא.
  const m = new Map();
  for (const [k, v] of url.searchParams) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    m.set(k, m.has(k) ? [].concat(m.get(k), v) : v);
  }
  return Object.fromEntries(m);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > MAX_BODY) { reject(Object.assign(new Error('too_large'), { code: 413 })); req.destroy(); return; }
      parts.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}

/* פונקציות של השרת בלבד (לא ב־api/, ולכן Vercel לא רואה אותן — שם כבר 12 מתוך 12):
   session — החיבור המשותף (שלב 2 בתוכנית שלוש האפליקציות). העוגייה שלו עובדת רק תחת thesnowball.app,
   כלומר רק בשרת שלנו — ב־Vercel (דומיין אחר) אין לה משמעות. */
const SERVER_ONLY = { session: 'lib/session.js' };

function createServer(opts = {}) {
  const dir = opts.dir || __dirname;
  const apiDir = opts.apiDir || path.join(dir, 'api');
  const cfg = opts.config || loadConfig(dir);
  const only = opts.serverOnly || (opts.dir ? {} : SERVER_ONLY);
  const names = new Set(fs.readdirSync(apiDir).filter((f) => /^[a-z0-9-]+\.js$/.test(f)).map((f) => f.slice(0, -3)));
  for (const n of Object.keys(only)) names.add(n);
  const ipHeader = String(opts.ipHeader != null ? opts.ipHeader : process.env.SNB_CLIENT_IP_HEADER || '').toLowerCase();
  const load = (name) => require(Object.prototype.hasOwnProperty.call(only, name) ? path.join(dir, only[name]) : path.join(apiDir, name + '.js'));

  async function invoke(name, req, res) {
    const handler = load(name);
    const fn = typeof handler === 'function' ? handler : handler && handler.default;
    if (typeof fn !== 'function') return res.status(500).json({ ok: false, error: 'no_handler' });
    const ms = (opts.durationScale || 1) * maxDuration(cfg, name) * 1000;
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => {
        if (!res.headersSent) res.status(504).json({ ok: false, error: 'timeout' });
        resolve();
      }, ms);
    });
    try {
      await Promise.race([Promise.resolve().then(() => fn(req, res)), timeout]);
    } catch (e) {
      if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal' });
      if (opts.log !== false) console.error('[api]', name, e && e.message);
    } finally {
      clearTimeout(timer);
    }
  }

  const server = http.createServer(async (req, res) => {
    decorate(res);
    let url;
    try { url = new URL(req.url, 'http://local'); } catch (e) { return res.status(400).json({ ok: false }); }
    // 26/10/2026 (בעקבות Vid Hub): ?v=1 = איזו גרסה רצה (ה־commit שממנו נבנתה התמונה). בלי — "ok" כמו תמיד (כלי השדרוג בודקים את הטקסט)
    if (url.pathname === '/healthz') return url.searchParams.get('v') === '1'
      ? res.status(200).json({ ok: true, sha: /^[0-9a-f]{40}$/.test(process.env.SNB_GIT_SHA || '') ? process.env.SNB_GIT_SHA : '' })
      : res.status(200).send('ok');
    const m = /^\/api\/([a-z0-9-]+)\/?$/.exec(url.pathname);
    if (!m || !names.has(m[1])) return res.status(404).json({ ok: false, error: 'not_found' });
    // הכתובת של הלקוח: רק מהכותרת של השער (שאר הכותרות ניתנות לזיוף מבחוץ)
    if (ipHeader) {
      const ip = String(req.headers[ipHeader] || '').split(',')[0].trim();
      if (ip) req.headers['x-forwarded-for'] = ip;
      else delete req.headers['x-forwarded-for'];
    }
    req.query = queryOf(url);
    try {
      req.body = parseBody(await readBody(req), req.headers['content-type']);
    } catch (e) {
      return res.status(e.code === 413 ? 413 : 400).json({ ok: false, error: e.code === 413 ? 'too_large' : 'bad_body' });
    }
    return invoke(m[1], req, res);
  });
  server.requestTimeout = 120e3;
  server.headersTimeout = 20e3;
  server.invoke = invoke;
  server.names = names;
  return server;
}

/* ---------------------------------------------------------------- הקרון (crons ב־vercel.json) */
// רק הצורה "דקה שעה * * *" (UTC) — מה שיש לנו; צורה אחרת לא נתמכת ולא רצה (ולא רצה בשקט — נרשם)
function parseCron(expr) {
  const m = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(String(expr || '').trim());
  if (!m || +m[1] > 59 || +m[2] > 23) return null;
  return { m: +m[1], h: +m[2] };
}

function cronDue(jobs, now, last) {
  const d = new Date(now);
  const key = d.toISOString().slice(0, 16);           // דקה ב־UTC — פעם אחת לכל דקה
  return jobs.filter((j) => j.m === d.getUTCMinutes() && j.h === d.getUTCHours() && last[j.path] !== key)
    .map((j) => { last[j.path] = key; return j; });
}

function startCron(server, cfg, opts = {}) {
  const jobs = [];
  for (const c of cfg.crons || []) {
    const t = parseCron(c.schedule);
    const name = (/^\/api\/([a-z0-9-]+)$/.exec(c.path || '') || [])[1];
    if (!t || !name || !server.names.has(name)) { console.error('[cron] לא נתמך:', c.path, c.schedule); continue; }
    jobs.push(Object.assign({ path: c.path, name }, t));
  }
  const last = {};
  const tick = () => {
    for (const j of cronDue(jobs, Date.now(), last)) {
      const headers = { 'user-agent': 'vercel-cron/1.0' };
      if (process.env.CRON_SECRET) headers.authorization = 'Bearer ' + process.env.CRON_SECRET;
      const req = { method: 'GET', url: j.path, headers, query: {}, body: undefined, socket: { remoteAddress: '127.0.0.1' } };
      const res = decorate(new http.ServerResponse(req));
      res.assignSocket(new (require('stream').PassThrough)());
      server.invoke(j.name, req, res).then(() => console.log('[cron]', j.path, res.statusCode));
    }
  };
  const iv = setInterval(tick, opts.every || 20e3);
  iv.unref();
  return { jobs, tick, stop: () => clearInterval(iv) };
}

/* 27/10/2026: הבודק של התראות המחיר ברקע (GET /api/ibkr-sync?job=px) — כל 5 שנ׳ (28/10: מ־30 — ההתראה מגיעה בזמן; בלי התראות פעילות אין בקשה החוצה), רק כאן (ב־Vercel אין קרון לדקות).
   לא תלוי ב־SNB_CRON: אין לו כפיל ב־Vercel, ולכן גם בחדר הייצור (SNB_CRON=off) הוא רץ. SNB_PXA=off — כבוי */
const PX_EVERY = 5e3;
function startPx(server, opts = {}) {
  if (!server.names.has('ibkr-sync')) return null;
  const tick = () => {
    const headers = { 'user-agent': 'snb-px/1.0' };
    if (process.env.CRON_SECRET) headers.authorization = 'Bearer ' + process.env.CRON_SECRET;
    const req = { method: 'GET', url: '/api/ibkr-sync?job=px', headers, query: { job: 'px' }, body: undefined, socket: { remoteAddress: '127.0.0.1' } };
    const res = decorate(new http.ServerResponse(req));
    res.assignSocket(new (require('stream').PassThrough)());
    return server.invoke('ibkr-sync', req, res).catch((e) => console.error('[px]', e && e.message));
  };
  const iv = setInterval(tick, opts.every || PX_EVERY);
  iv.unref();
  return { tick, stop: () => clearInterval(iv) };
}

module.exports = { createServer, startCron, startPx, SERVER_ONLY, parseBody, parseCron, cronDue, maxDuration, decorate, unpackEnv };

if (require.main === module) {
  const unpacked = unpackEnv(process.env);
  if (unpacked < 0) console.error('[snb-app] ✗ SNB_ENV_GZ לא נפתח — השרתון עולה בלי הסודות שבו');
  // 24/10/2026: תור ההעברה של "המנוי שלי" (lib/relay.js) — חי בזיכרון של התהליך הזה בלבד (ב־Vercel אין)
  if (process.env.SNB_RELAY_HUB_ON == null) process.env.SNB_RELAY_HUB_ON = '1';
  const server = createServer();
  const port = +process.env.PORT || 3000;
  server.listen(port, '0.0.0.0', () => console.log('[snb-app] מאזין על', port, '·', server.names.size, 'פונקציות'));
  if (process.env.SNB_CRON === 'on') startCron(server, loadConfig(__dirname));
  if (process.env.SNB_PXA !== 'off') startPx(server);
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
