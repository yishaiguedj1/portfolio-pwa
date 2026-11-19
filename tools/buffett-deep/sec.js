#!/usr/bin/env node
/* בדיקת העומק של מכפיל באפט — גישה הוגנת ל־SEC, עם מטמון על דיסק (docs/buffett-pe-audit.md §9).
   · User-Agent מזהה; 250ms לפחות בין בקשות (גם בין תהליכים — קובץ נעילה בתיקיית המטמון); ב־429/403 — המתנה גדלה (30s, 60s,
     120s… עד 10 דקות — הלקח מ־19/11/2026: אחרי כמה מאות בקשות ברצף SEC חוסמת לכ־10 דקות).
   · כל קובץ נשמר פעם אחת (`<cache>/<host>/<path>`), כולל 404 (קובץ `.404`) — הרצה חוזרת לא פונה לרשת.
   שימוש כספרייה: const sec = require('./sec'); await sec.get(url) → טקסט; sec.json(url).
   משורת הפקודה: node tools/buffett-deep/sec.js <url>  (מדפיס את 300 התווים הראשונים) */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const UA = process.env.SEC_UA || 'TheSnowball/1.0 data@thesnowball.app';
const CACHE = process.env.BD_CACHE || path.join(process.env.BD_DIR || '.', 'cache');
const GAP = 250;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lockF = () => path.join(CACHE, '.last');

async function pace() {
  fs.mkdirSync(CACHE, { recursive: true });
  for (;;) {
    let last = 0;
    try { last = +fs.readFileSync(lockF(), 'utf8') || 0; } catch (e) { /* ראשון */ }
    const w = last + GAP - Date.now();
    if (w <= 0) { fs.writeFileSync(lockF(), String(Date.now())); return; }
    await sleep(w);
  }
}

function fileOf(url) {
  const u = new URL(url);
  let p = path.join(CACHE, u.host, decodeURIComponent(u.pathname));
  if (p.endsWith('/')) p += '_index';
  return p;
}

async function get(url, opt = {}) {
  const f = fileOf(url);
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  if (fs.existsSync(f + '.404')) { const e = new Error('http_404 ' + url); e.code = 404; throw e; }
  let wait = 30000;
  for (let i = 0; i < 8; i++) {
    await pace();
    let r;
    try { r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' } }); } catch (e) { await sleep(5000 * (i + 1)); continue; }
    if (r.status === 404) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.404', ''); const e = new Error('http_404 ' + url); e.code = 404; throw e; }
    if (r.status === 429 || r.status === 403 || r.status >= 500) {
      if (!opt.quiet) console.error('SEC ' + r.status + ' — ממתין ' + Math.round(wait / 1000) + 's');
      await sleep(wait); wait = Math.min(wait * 2, 600000); continue;
    }
    const t = await r.text();
    if (!r.ok) throw new Error('http_' + r.status + ' ' + url);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, t);
    return t;
  }
  throw new Error('SEC: נכשל אחרי ניסיונות חוזרים ' + url);
}
const json = async (url) => JSON.parse(await get(url));
const pad = (cik) => String(+cik).padStart(10, '0');
const submissions = (cik) => json('https://data.sec.gov/submissions/CIK' + pad(cik) + '.json');
const facts = (cik) => json('https://data.sec.gov/api/xbrl/companyfacts/CIK' + pad(cik) + '.json');
const accBase = (cik, acc) => 'https://www.sec.gov/Archives/edgar/data/' + (+cik) + '/' + acc.replace(/-/g, '') + '/';

module.exports = { get, json, submissions, facts, accBase, pad, CACHE };

if (require.main === module) get(process.argv[2]).then((t) => console.log(t.slice(0, 300))).catch((e) => { console.error(String(e)); process.exit(1); });
