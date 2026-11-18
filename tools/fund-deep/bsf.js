#!/usr/bin/env node
// בדיקת העומק, גל 2 — "המאזן המודפס של כל הגשה" (אב־טיפוס לשארית של F7, ‏docs/research/fund-deep/wave-2.md):
// לכל 10-K/10-Q ‏(בלי ‎/A‎) — FilingSummary.xml ודף ה־R של המאזן (lib/secface.js), והחוב בכל עמודה לפי debtFace של השרתון.
// מקור בלתי תלוי ב־companyfacts ובבודק (FSDS). נתונים ציבוריים של SEC בלבד; הכל בתיקיית העבודה (--w <dir>/bsf), לא בריפו.
//   node tools/fund-deep/bsf.js fetch --w <dir> [--only PH,MCD] [--par 2] [--since 2009]   ההורדה (~2 בקשות להגשה, מטמון בקבצים)
//   node tools/fund-deep/bsf.js cmp   --w <dir> [--only …] [--fs <fundamentals.js>]         החוב לפי ההגשה מול הצפוי (exp.json של debt_exp.py)
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '../..');
const argv = process.argv.slice(2), cmd = argv[0], o = {};
for (let i = 1; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const k = argv[i].slice(2), v = argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  o[k] = v;
}
if (!['fetch', 'cmp'].includes(cmd) || !o.w) { console.error('שימוש: fetch | cmp, עם --w <תיקיית עבודה>'); process.exit(2); }
const W = path.resolve(o.w), D = path.join(W, 'bsf'), DD = path.join(W, 'debt');
fs.mkdirSync(D, { recursive: true });
const pad = (c) => String(c).padStart(10, '0');
const rows = fs.readFileSync(o.ciks || path.join(__dirname, 'ciks.tsv'), 'utf8').split('\n').map((l) => l.split(/\s+/)).filter((p) => p[1] && /^\d+$/.test(p[1]));
const only = o.only && o.only !== true ? new Set(String(o.only).split(',')) : null;
const SF = require(path.join(ROOT, 'ibkr-proxy/lib/secface.js'));
const gz = (f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());
const bsF = (cik) => path.join(D, cik + '.json');
const PERIODIC = /^(10-K|10-Q|10-KT|10-QT)$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// כל ההגשות התקופתיות: recent + דפי ההמשך (files) של submissions
async function filingsOf(cik, get) {
  const sub = fs.existsSync(path.join(DD, cik + '.sub.json.gz')) ? gz(path.join(DD, cik + '.sub.json.gz')) : JSON.parse(await get('https://data.sec.gov/submissions/CIK' + cik + '.json'));
  const out = [];
  const add = (r) => { for (let i = 0; i < r.form.length; i++) if (PERIODIC.test(r.form[i])) out.push({ acc: r.accessionNumber[i], form: r.form[i], filed: r.filingDate[i], rep: r.reportDate[i] }); };
  add(sub.filings.recent);
  for (const f of sub.filings.files || []) {
    const p = path.join(D, 'sub-' + f.name);
    let t;
    if (fs.existsSync(p)) t = fs.readFileSync(p, 'utf8');
    else { t = await get('https://data.sec.gov/submissions/' + f.name); if (t) fs.writeFileSync(p, t); }
    if (t) add(JSON.parse(t));
  }
  return out;
}

async function fetchAll() {
  const UA = { headers: { 'User-Agent': 'TheSnowball/1.0 data@thesnowball.app' } };
  let last = 0;
  const gap = +(o.gap || 130);
  const get = async (url) => {
    for (let i = 0; i < 4; i++) {
      const w = last + gap - Date.now(); last = Math.max(Date.now(), last + gap); if (w > 0) await sleep(w);
      try {
        const r = await fetch(url, UA);
        if (r.status === 404) return null;
        if (r.status === 429 || r.status === 403) { await sleep(10000 * (i + 1)); continue; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.text();
      } catch (e) { if (i === 3) throw e; await sleep(2000 * (i + 1)); }
    }
    return null;
  };
  const since = String(o.since || 2009);
  const seen = new Set(), queue = rows.filter(([s, c]) => (!only || only.has(s)) && !seen.has(pad(c)) && seen.add(pad(c)));
  let nReq = 0;
  const one = async (sym, cik) => {
    const f = bsF(cik), have = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
    let fl;
    try { fl = (await filingsOf(cik, get)).filter((x) => x.filed >= since); } catch (e) { console.log(sym, 'submissions נכשל', e.message); return; }
    let n = 0;
    for (const x of fl) {
      if (have[x.acc]) continue;
      const base = 'https://www.sec.gov/Archives/edgar/data/' + (+cik) + '/' + x.acc.replace(/-/g, '') + '/';
      const rec = { form: x.form, filed: x.filed, rep: x.rep };
      try {
        const xml = await get(base + 'FilingSummary.xml'); nReq++;
        const pick = xml ? SF.pickStatements(xml) : {};
        if (!xml) rec.err = 'nofs';
        else if (!pick.bs) rec.err = /R\d+\.xml/.test(xml) ? 'xml' : 'nobs';
        else { const h = await get(base + pick.bs); nReq++; if (h) { const p = SF.parseR(h); rec.bs = { title: p.title, cols: p.cols, scale: p.scale, rows: p.rows }; } else rec.err = 'nor'; }
      } catch (e) { rec.err = 'x:' + String(e.message || e).slice(0, 40); }
      if (rec.err && rec.err.startsWith('x:')) continue; // תקלת רשת — לא נשמר, ינוסה שוב
      have[x.acc] = rec; n++;
      if (n % 10 === 0) fs.writeFileSync(f, JSON.stringify(have));
    }
    fs.writeFileSync(f, JSON.stringify(have));
    console.log(sym, fl.length, 'הגשות ·', n, 'חדשות · בקשות עד כה', nReq);
  };
  await Promise.all(Array.from({ length: +(o.par || 2) }, async () => { while (queue.length) { const [s, c] = queue.shift(); await one(s, pad(c)); } }));
  console.log('סיום · בקשות:', nReq);
}

// החוב לפי ההגשה: לכל תאריך מאזן — ההגשה השנתית האחרונה שמדפיסה אותו (אחרת הרבעונית האחרונה), כמו הצפוי של הבודק
function debtByDate(F, have, cur) {
  const per = new Map(); // end → [{annual, filed, v, acc}]
  for (const [acc, x] of Object.entries(have)) {
    if (!x.bs) continue;
    const dF = F.debtFace({ bs: x.bs }, cur);
    if (!dF) continue;
    for (const [end, ci] of dF.cols) {
      // רק עמודה שיש בה סך נכסים (עמודת מאזן, לא ביאור)
      const a = x.bs.rows.find((r) => r.tag === 'Assets' || r.tag === 'LiabilitiesAndStockholdersEquity');
      if (!a || a.v[ci] == null) continue;
      const v = dF.lines.length ? dF.tot.get(end) : 0;
      if (!per.has(end)) per.set(end, []);
      per.get(end).push({ annual: !/^10-Q/.test(x.form), filed: x.filed, v, acc });
    }
  }
  const out = new Map();
  for (const [end, arr] of per) {
    const ann = arr.filter((t) => t.annual), best = (ann.length ? ann : arr).reduce((a, b) => (b.filed > a.filed ? b : a));
    out.set(end, best);
  }
  return out;
}

function cmpAll() {
  const F = require(path.resolve(o.fs || path.join(ROOT, 'ibkr-proxy/lib/fundamentals.js')));
  const EXP = JSON.parse(fs.readFileSync(path.join(DD, 'exp.json'), 'utf8'));
  const close = (a, b) => Math.abs(a - b) <= Math.max(1.5e6, 0.005 * Math.abs(b));
  const day = (s) => Date.parse(s + 'T00:00:00Z') / 864e5;
  const tot = { ok: 0, bad: 0, miss: 0, none: 0 }, bad = [], errs = {};
  for (const [cik0, ex] of Object.entries(EXP)) {
    if (only && !only.has(ex.sym)) continue;
    const cik = pad(cik0);
    if (!fs.existsSync(bsF(cik))) continue;
    const have = JSON.parse(fs.readFileSync(bsF(cik), 'utf8'));
    for (const x of Object.values(have)) if (x.err) errs[x.err] = (errs[x.err] || 0) + 1;
    const got = debtByDate(F, have, ex.cur || 'USD');
    for (const [d, e] of Object.entries(ex.d)) {
      if (e[3]) continue; // צפוי חלקי
      const k = [...got.keys()].find((g) => Math.abs(day(g) - day(d)) <= 3);
      if (!k) { tot.none++; continue; }
      const v = got.get(k).v;
      if (v == null) { tot.miss++; continue; }
      if (close(v, e[0]) || e[1].some((y) => close(v, y))) tot.ok++;
      else { tot.bad++; bad.push([ex.sym, d, Math.round(v / 1e6), Math.round(e[0] / 1e6), got.get(k).acc]); }
    }
  }
  console.log('לפי ההגשה:', JSON.stringify(tot), '· תקלות בהגשות:', JSON.stringify(errs));
  const by = {}; for (const b of bad) by[b[0]] = (by[b[0]] || 0) + 1;
  console.log('שגויים לפי חברה (20 הגדולות):', Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 20).map((x) => x.join(':')).join(' '));
  fs.writeFileSync(path.join(D, 'bad.json'), JSON.stringify(bad));
}

if (cmd === 'fetch') fetchAll().catch((e) => { console.error(e); process.exit(1); });
else cmpAll();
