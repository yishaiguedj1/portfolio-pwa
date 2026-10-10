// ת3 (הכנה, 10/10/2026): השרתון כשרת HTTP רגיל — ibkr-proxy/server.js עוטף את אותן פונקציות של Vercel בלי שינוי.
// בודק: הניתוב, req.body/query כמו ב־Vercel, res.status/json/send, מגבלת הזמן מ־vercel.json, שגיאה → 500,
// כתובת הלקוח רק מכותרת השער, הקרון היומי, ופונקציות אמיתיות (CORS / 405) בלי רשת.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const S = require('../ibkr-proxy/server.js');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };

function req(port, method, p, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers }, (res) => {
      const parts = [];
      res.on('data', (c) => parts.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(parts);
        let json = null;
        try { json = JSON.parse(buf.toString()); } catch (e) { /* לא JSON */ }
        resolve({ status: res.statusCode, headers: res.headers, buf, json });
      });
    });
    r.on('error', reject);
    if (body != null) r.write(body);
    r.end();
  });
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

(async () => {
  // 1. פונקציות מדומות בתיקייה זמנית
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snbapp-'));
  const api = path.join(dir, 'api');
  fs.mkdirSync(api);
  fs.writeFileSync(path.join(api, 'echo.js'), `module.exports = (req, res) => res.status(200).json({ m: req.method, q: req.query, b: req.body, ip: req.headers['x-forwarded-for'] || null });`);
  fs.writeFileSync(path.join(api, 'slow.js'), `module.exports = () => new Promise(() => {});`);
  fs.writeFileSync(path.join(api, 'boom.js'), `module.exports = () => { throw new Error('x'); };`);
  fs.writeFileSync(path.join(api, 'bin.js'), `module.exports = (req, res) => res.status(200).send(Buffer.from([1, 2, 3]));`);
  fs.writeFileSync(path.join(api, 'cron.js'), `module.exports = (req, res) => { global.__cron = (global.__cron || 0) + 1; global.__cronAuth = req.headers.authorization; res.status(200).json({ ok: true }); };`);
  const config = { functions: { 'api/slow.js': { maxDuration: 1 } }, crons: [{ path: '/api/cron', schedule: '5 12 * * *' }, { path: '/api/cron', schedule: '*/5 * * * *' }] };
  const srv = S.createServer({ dir, apiDir: api, config, ipHeader: 'cf-connecting-ip', durationScale: 0.2, log: false });
  const port = await listen(srv);

  let r = await req(port, 'POST', '/api/echo?a=1&a=2&b=x', { body: JSON.stringify({ op: 'status' }), headers: { 'content-type': 'application/json', 'cf-connecting-ip': '5.6.7.8', 'x-forwarded-for': '1.1.1.1' } });
  ok(r.status === 200 && r.json.b.op === 'status' && r.json.m === 'POST', 'JSON → req.body אובייקט, כמו Vercel');
  ok(Array.isArray(r.json.q.a) && r.json.q.a.join() === '1,2' && r.json.q.b === 'x', 'req.query (מפתח חוזר = מערך)');
  ok(r.json.ip === '5.6.7.8', 'כתובת הלקוח מכותרת השער בלבד (x-forwarded-for מבחוץ נדרס)');
  r = await req(port, 'GET', '/api/echo?__proto__=x&constructor=y&ok=1');
  ok(r.json.q.ok === '1' && !('__proto__' in r.json.q && r.json.q.__proto__ === 'x') && Object.keys(r.json.q).join() === 'ok' && ({}).x === undefined, 'בלי זיהום prototype משמות פרמטרים');
  r = await req(port, 'POST', '/api/echo', { body: 'not json', headers: { 'content-type': 'application/json' } });
  ok(r.json.b === 'not json', 'JSON לא תקין → מחרוזת (הפונקציות מטפלות בזה בעצמן)');
  r = await req(port, 'POST', '/api/echo', { body: 'x', headers: { 'content-type': 'text/plain', 'x-forwarded-for': '1.1.1.1' } });
  ok(r.json.b === 'x' && r.json.ip === null, 'טקסט → מחרוזת; בלי כותרת השער — בלי כתובת מזויפת');
  r = await req(port, 'GET', '/api/echo');
  ok(r.json.b === undefined || r.json.b === null, 'בלי גוף → undefined');
  r = await req(port, 'GET', '/api/slow');
  ok(r.status === 504 && r.json.error === 'timeout', 'מגבלת הזמן מ־vercel.json (maxDuration) → 504');
  r = await req(port, 'GET', '/api/boom');
  ok(r.status === 500 && r.json.error === 'internal', 'שגיאה בפונקציה → 500 בלי פרטים');
  r = await req(port, 'GET', '/api/bin');
  ok(r.buf.length === 3 && r.headers['content-type'] === 'application/octet-stream', 'res.send(Buffer)');
  r = await req(port, 'GET', '/api/../server');
  ok(r.status === 404, 'נתיב מחוץ ל־api → 404');
  r = await req(port, 'GET', '/api/nope');
  ok(r.status === 404, 'פונקציה שלא קיימת → 404');
  r = await req(port, 'GET', '/healthz');
  ok(r.status === 200 && r.buf.toString() === 'ok', '/healthz');
  r = await req(port, 'POST', '/api/echo', { body: Buffer.alloc(5 * 1024 * 1024), headers: { 'content-type': 'application/octet-stream' } }).catch(() => ({ status: 413 }));
  ok(r.status === 413, 'גוף מעל 4.5MB → 413');

  // 2. הקרון: רק "דקה שעה * * *"; פעם אחת לדקה; עם CRON_SECRET
  ok(S.parseCron('5 12 * * *').h === 12 && S.parseCron('*/5 * * * *') === null && S.parseCron('61 1 * * *') === null, 'parseCron');
  const last = {};
  const jobs = [{ path: '/api/cron', name: 'cron', m: 5, h: 12 }];
  const t = Date.UTC(2026, 9, 10, 12, 5, 10);
  ok(S.cronDue(jobs, t, last).length === 1 && S.cronDue(jobs, t + 30e3, last).length === 0, 'פעם אחת בדקה');
  ok(S.cronDue(jobs, Date.UTC(2026, 9, 11, 12, 5, 0), last).length === 1 && S.cronDue(jobs, Date.UTC(2026, 9, 11, 12, 6, 0), last).length === 0, 'יום הבא — שוב; דקה אחרת — לא');
  process.env.CRON_SECRET = 'sec';
  const realNow = Date.now;
  Date.now = () => Date.UTC(2026, 9, 10, 12, 5, 30);
  const c = S.startCron(srv, config, { every: 1e9 });
  ok(c.jobs.length === 1, 'צורה שלא נתמכת לא נרשמת');
  c.tick();
  await new Promise((r2) => setTimeout(r2, 50));
  c.stop();
  Date.now = realNow;
  ok(global.__cron === 1 && global.__cronAuth === 'Bearer sec', 'הקרון קורא לפונקציה עם CRON_SECRET (כמו Vercel)');
  srv.close();

  // 3. הפונקציות האמיתיות — בלי רשת: CORS (OPTIONS) ו־405 על GET
  const real = S.createServer({ log: false });
  const p2 = await listen(real);
  ok(real.names.size === 12 && real.names.has('studio') && real.names.has('ibkr-sync'), 'כל 12 הפונקציות של api/');
  r = await req(p2, 'OPTIONS', '/api/flex-request', { headers: { origin: 'https://yishaiguedj1.github.io' } });
  ok(r.status === 204 && r.headers['access-control-allow-origin'] === 'https://yishaiguedj1.github.io', 'CORS כמו ב־Vercel');
  r = await req(p2, 'GET', '/api/flex-request', { headers: { origin: 'https://yishaiguedj1.github.io' } });
  ok(r.status === 405, 'flex-request ב־GET → 405 (הפונקציה עצמה)');
  real.close();

  // 4. הקונטיינר
  const df = fs.readFileSync(path.join(__dirname, '..', 'infra', 'app', 'Dockerfile'), 'utf8');
  ok(/ARG NODE_IMAGE=node:[\w.-]+@sha256:[0-9a-f]{64}/.test(df) && /FROM \$\{NODE_IMAGE\}/.test(df), 'בסיס נעול ב־digest');
  const code = df.replace(/^#.*$/mg, '');
  ok(/USER 10001:10001/.test(code) && !/npm (install|ci)/.test(code), 'משתמש רגיל, בלי תלויות npm (השרתון בלי תלויות)');
  ok(!/(ANTHROPIC|GDRIVE|VAULT|SECRET)/.test(code), 'בלי סודות בתמונה');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ibkr-proxy', 'package.json'), 'utf8'));
  ok(!pkg.dependencies || !Object.keys(pkg.dependencies).length, 'השרתון בלי תלויות — מה שנבדק כאן הוא מה שרץ');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + e.message); process.exit(1); });
