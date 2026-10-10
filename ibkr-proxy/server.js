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

const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function queryOf(url) {
  // בלי prototype ובלי מפתחות מסוכנים — שם פרמטר מהכתובת לא יכול לזהם אובייקטים (CodeQL: remote property injection)
  const q = Object.create(null);
  for (const [k, v] of url.searchParams) {
    if (BAD_KEYS.has(k)) continue;
    q[k] = Object.prototype.hasOwnProperty.call(q, k) ? [].concat(q[k], v) : v;
  }
  return q;
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

function createServer(opts = {}) {
  const dir = opts.dir || __dirname;
  const apiDir = opts.apiDir || path.join(dir, 'api');
  const cfg = opts.config || loadConfig(dir);
  const names = new Set(fs.readdirSync(apiDir).filter((f) => /^[a-z0-9-]+\.js$/.test(f)).map((f) => f.slice(0, -3)));
  const ipHeader = String(opts.ipHeader != null ? opts.ipHeader : process.env.SNB_CLIENT_IP_HEADER || '').toLowerCase();
  const load = (name) => require(path.join(apiDir, name + '.js'));

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
    if (url.pathname === '/healthz') return res.status(200).send('ok');
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

module.exports = { createServer, startCron, parseBody, parseCron, cronDue, maxDuration, decorate };

if (require.main === module) {
  const server = createServer();
  const port = +process.env.PORT || 3000;
  server.listen(port, '0.0.0.0', () => console.log('[snb-app] מאזין על', port, '·', server.names.size, 'פונקציות'));
  if (process.env.SNB_CRON === 'on') startCron(server, loadConfig(__dirname));
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
