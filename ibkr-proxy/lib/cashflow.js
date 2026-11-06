'use strict';
/* 6/11/2026 — Cashflow, האפליקציה הרביעית (התוכנית: riseup-finance/docs/web-app-plan.md), גל 1: מודול השרת.
   POST /api/cashflow (רק בשרת — SERVER_ONLY ב־server.js; ב־Vercel אין, ושם 404).
   מנוע הניתוח הוא עותק של riseup-finance (lib/cashflow/, ראו SOURCE.md — לא עורכים שם). כל דוח רץ כתהליך נפרד
   (runReport) עם סביבה נקייה: רק PATH/HOME/TZ והטוקן של המשתמש — אף סוד אחר של השרת לא עובר לתהליך.
   הקריאה לרייזאפ ישירה ב־HTTPS לאותן נקודות קצה של קריאה בלבד שהשרת הרשמי (@riseup-oss/mcp) קורא להן
   (RISEUP_TRANSPORT=http) — בלי npx ובלי הורדת חבילה בזמן ריצה (הקונטיינר read_only).

   פעולות (op): status · connect { pat } · disconnect · report { name, args?, refresh? }

   אבטחה (CLAUDE.md סעיף 3, "מערכות משלנו"):
   - כבוי כברירת מחדל: SNB_CASHFLOW=on מדליק. כבוי — 503 'off'.
   - הזהות רק מטוקן Firebase שהשרת מאמת בעצמו (verifyIdToken); ה־uid לעולם לא מגוף הבקשה.
   - אפליקציה: המקור cashflow(-staging).thesnowball.app או האתר המאוחד ('all'); טענת app בטוקן — cashflow או all.
   - רק בעלים: CASHFLOW_USERS (מיילים), ואם לא הוגדר — מנהל המערכת (isAdmin). כל אחד אחר — 403.
   - הטוקן של רייזאפ נשמר רק מוצפן בכספת (lib/vault.js, AES-256-GCM, AAD שקושר ל־uid), בקובץ 0600 במסד (/data).
     לעולם לא חוזר לטלפון, לא נרשם ביומן, ולא נשמר ב־git.
   - תשובות: Cache-Control no-store; מטמון בזיכרון 15 דק׳ לכל דוח (המכסה של רייזאפ: 1000 ביום לטוקן); קצב לכל משתמש. */
const fs = require('fs');
const path = require('path');
const G = require('./gauth');
const V = require('./vault');
const { appForOrigin, sessEnv } = require('./session');

const MAX_BODY = 64 * 1024;
const RATE_MIN = 30;
const CACHE_MS = 15 * 60 * 1000;
const TOKEN_DAYS = 30;
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const PAT_RE = /^riseup_pat_[A-Za-z0-9_-]{20,200}$/;
const REPORTS = new Set(['snapshot', 'month', 'monthly-review', 'subscriptions', 'forecast', 'mortgage', 'doctor', 'accounts']);
const ORIGIN_RE = /^https:\/\/cashflow(-staging)?\.thesnowball\.app$/;

const isMap = (v) => v && typeof v === 'object' && !Array.isArray(v);
const aad = (uid) => 'cashflow|pat|' + uid;

/* אחסון: קובץ JSON אחד במסד, רק ערכים מוצפנים. כתיבה אטומית (קובץ זמני + rename), הרשאות 0600 */
function fileStore(env) {
  const dir = env.SNB_CASHFLOW_DIR || env.SNB_LDB_DIR || '/data';
  const file = path.join(dir, 'cashflow-vault.json');
  const read = () => { try { const o = JSON.parse(fs.readFileSync(file, 'utf8')); return isMap(o) ? o : {}; } catch (e) { return {}; } };
  const write = (o) => {
    const tmp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(o), { mode: 0o600 });
    fs.renameSync(tmp, file);
  };
  return {
    get: (uid) => read()[uid] || null,
    put: (uid, rec) => { const o = read(); o[uid] = rec; write(o); },
    del: (uid) => { const o = read(); delete o[uid]; write(o); },
  };
}

let runnerP = null;
function defaultRun(name, args, token) {
  runnerP = runnerP || import(path.join(__dirname, 'cashflow', 'scripts', 'lib', 'runner.mjs'));
  return runnerP.then((m) => m.runReport(name, args, { token, cleanEnv: true, transport: 'http' }));
}

function ownerOk(u, env) {
  const list = G.emails(env.CASHFLOW_USERS);
  return list.length ? G.hasEmail(u, list) : G.isAdmin(u);
}

function makeHandler(over = {}) {
  const hits = new Map();
  const cache = new Map();
  const limited = (uid, now) => {
    const arr = (hits.get(uid) || []).filter((t) => now - t < 60e3);
    arr.push(now);
    hits.set(uid, arr);
    if (hits.size > 5000) hits.clear();
    return arr.length > RATE_MIN;
  };
  return async function handler(req, res) {
    const env = over.env || process.env;
    const deps = {
      now: over.now || Date.now,
      verify: over.verify || ((t) => G.verifyIdToken(t)),
      store: over.store || fileStore(env),
      run: over.run || defaultRun,
      seal: over.seal || V.seal,
      open: over.open || V.open,
      owner: over.owner || ((u) => ownerOk(u, env)),
    };
    const h = req.headers || {};
    const origin = String(h.origin || h.Origin || '');
    const oa = ORIGIN_RE.test(origin) ? 'cashflow' : appForOrigin(origin, sessEnv(env));
    res.setHeader('Vary', 'Origin');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (oa === 'cashflow' || oa === 'all') {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
    } else {
      return res.status(403).json({ ok: false, error: 'forbidden_origin' });
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
    if (env.SNB_CASHFLOW !== 'on') return res.status(503).json({ ok: false, error: 'off' });

    let body = req.body;
    if (typeof body === 'string') { if (body.length > MAX_BODY) return res.status(413).json({ ok: false, error: 'too_large' }); try { body = JSON.parse(body); } catch (e) { body = null; } }
    if (!isMap(body)) return res.status(400).json({ ok: false, error: 'bad_body' });

    let u;
    try { u = await deps.verify(String(body.idToken || '')); } catch (e) { return res.status(401).json({ ok: false, error: 'bad_token' }); }
    const uid = u && u.uid;
    if (!UID_RE.test(String(uid || ''))) return res.status(401).json({ ok: false, error: 'bad_token' });
    if (u.app && u.app !== 'all' && u.app !== 'cashflow') return res.status(403).json({ ok: false, error: 'wrong_app' });
    if (!deps.owner(u)) return res.status(403).json({ ok: false, error: 'not_allowed' });
    const now = deps.now();
    if (limited(uid, now)) return res.status(429).json({ ok: false, error: 'rate' });

    const op = String(body.op || '');
    const clearCache = () => { for (const k of cache.keys()) if (k.startsWith(uid + '|')) cache.delete(k); };

    if (op === 'status') {
      const rec = deps.store.get(uid);
      if (!rec) return res.status(200).json({ ok: true, connected: false });
      const ageDays = Math.floor((now - rec.at) / 86400000);
      return res.status(200).json({ ok: true, connected: true, connectedAt: rec.at, ageDays, expiresInDays: TOKEN_DAYS - ageDays });
    }
    if (op === 'connect') {
      const pat = String(body.pat || '').trim();
      if (!PAT_RE.test(pat)) return res.status(400).json({ ok: false, error: 'bad_pat' });
      let sealed;
      try { sealed = deps.seal({ pat }, aad(uid)); } catch (e) { return res.status(503).json({ ok: false, error: 'vault_not_configured' }); }
      deps.store.put(uid, { v: sealed, at: now });
      clearCache();
      return res.status(200).json({ ok: true, connected: true });
    }
    if (op === 'disconnect') {
      deps.store.del(uid);
      clearCache();
      return res.status(200).json({ ok: true, connected: false });
    }
    if (op === 'report') {
      const name = String(body.name || '');
      if (!REPORTS.has(name)) return res.status(400).json({ ok: false, error: 'bad_report' });
      const args = Array.isArray(body.args) ? body.args.slice(0, 8).map(String) : [];
      const rec = deps.store.get(uid);
      const opened = rec && deps.open(rec.v, aad(uid));
      if (!opened || !PAT_RE.test(String(opened.pat || ''))) return res.status(409).json({ ok: false, error: 'not_connected' });
      const key = uid + '|' + name + '|' + JSON.stringify(args);
      const hit = cache.get(key);
      if (hit && !body.refresh && now - hit.at < CACHE_MS) return res.status(200).json({ ok: true, report: hit.report, at: hit.at, cached: true });
      let report;
      try {
        report = await deps.run(name, args, opened.pat);
      } catch (e) {
        const msg = String((e && e.message) || '');
        if (/\(401\)|401/.test(msg)) return res.status(200).json({ ok: false, error: 'riseup_token_rejected' });
        if (/Invalid report arguments/.test(msg)) return res.status(400).json({ ok: false, error: 'bad_args' });
        return res.status(502).json({ ok: false, error: 'report_failed' });
      }
      cache.set(key, { at: now, report });
      if (cache.size > 500) cache.clear();
      return res.status(200).json({ ok: true, report, at: now, cached: false });
    }
    return res.status(400).json({ ok: false, error: 'bad_op' });
  };
}

module.exports = makeHandler();
module.exports.makeHandler = makeHandler;
module.exports.fileStore = fileStore;
module.exports.REPORTS = REPORTS;
