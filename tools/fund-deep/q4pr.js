#!/usr/bin/env node
// בדיקת העומק, גל 2 — הרבעון הרביעי מההודעה לעיתונות (F2; ‏lib/secpr.js, ‏lib/bsfiled.js ‏readPr, ‏fundamentals.js ‏q4Press):
// לכל סוף שנה — ה־8-K של התוצאות (Item 2.02) ← EX-99.1 ← שורות "Diluted" — בדיוק כמו עבודת הרקע בשרת, למטמון <w>/pr/<CIK>.p.json.
// הדוח: מה ש־q4Press משנה (מניות ורווח למניה ברבעונים הרביעיים המוערכים), ובשנים שה־XBRL כן מתייג את הרבעון — המפענח מול XBRL.
// נתונים ציבוריים של SEC בלבד.
//   node tools/fund-deep/q4pr.js --w <dir> [--only AAPL,MSFT] [--par 4 --gap 110] [--offline] [--fs <fundamentals.js>]
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '../..');
const argv = process.argv.slice(2), o = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const k = argv[i].slice(2), v = argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  o[k] = v;
}
if (!o.w) { console.error('שימוש: --w <תיקיית עבודה>'); process.exit(2); }
const W = path.resolve(o.w), DD = path.join(W, 'debt'), PD = path.join(W, 'pr'), BD = path.join(W, 'bsf');
fs.mkdirSync(PD, { recursive: true });
const F = require(path.resolve(o.fs || path.join(ROOT, 'ibkr-proxy/lib/fundamentals.js')));
const P = require(path.join(ROOT, 'ibkr-proxy/lib/secpr.js'));
const BSF = require(path.join(ROOT, 'ibkr-proxy/lib/bsfiled.js'));
const pad = (c) => String(c).padStart(10, '0');
const gz = (f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = o.only && o.only !== true ? new Set(String(o.only).split(',')) : null;
const rows = fs.readFileSync(path.join(__dirname, 'ciks.tsv'), 'utf8').split('\n').map((l) => l.split(/\s+/)).filter((p) => p[1] && /^\d+$/.test(p[1]));

let last = 0; const gap = +(o.gap || 110); let nReq = 0;
// כמו getText של השרתון: 404 → שגיאה "http_404" (נשמר כחסר), תקלה אחרת → שגיאה (ינוסה שוב)
const getText = async (url) => {
  if (o.offline) throw new Error('offline');
  for (let i = 0; i < 4; i++) {
    const w = last + gap - Date.now(); last = Math.max(Date.now(), last + gap); if (w > 0) await sleep(w);
    nReq++;
    let r; try { r = await fetch(url, { headers: { 'User-Agent': 'TheSnowball/1.0 data@thesnowball.app' } }); } catch (e) { if (i === 3) throw e; await sleep(2000 * (i + 1)); continue; }
    if (r.status === 404) throw new Error('http_404');
    if (r.status === 429 || r.status === 403) { await sleep(10000 * (i + 1)); continue; }
    if (!r.ok) { if (i === 3) throw new Error('http_' + r.status); await sleep(2000); continue; }
    return await r.text();
  }
  throw new Error('http_retry');
};

// submissions ודפי ההמשך (המטמון המשותף עם bsf.js; דף חסר — נקרא ונשמר)
async function subFiles(cik) {
  const f = path.join(DD, cik + '.sub.json.gz'); if (!fs.existsSync(f)) return null;
  const sub = gz(f), files = [];
  fs.mkdirSync(BD, { recursive: true });
  for (const x of sub.filings.files || []) {
    const p = path.join(BD, 'sub-' + x.name);
    if (!fs.existsSync(p)) { try { fs.writeFileSync(p, await getText('https://data.sec.gov/submissions/' + x.name)); } catch (e) { continue; } }
    files.push(JSON.parse(fs.readFileSync(p, 'utf8')));
  }
  return { sub, files };
}

async function fetchOne(cik) {
  const S = await subFiles(cik); if (!S) return null;
  const pf = path.join(PD, cik + '.p.json'), p = fs.existsSync(pf) ? JSON.parse(fs.readFileSync(pf, 'utf8')) : {};
  const list = BSF.periodic(S.sub, S.files, BSF.SINCE_Y);
  const ends = [...new Set(list.filter((f) => /^10-K/.test(f.form) && f.rep).map((f) => f.rep))];
  const its = P.pickItems(BSF.merge8k(S.sub, S.files), ends).filter((it) => !p[it.end]);
  let n = 0;
  for (const it of its) { const r = await BSF.readPr(cik, it, getText).catch(() => null); if (r) { p[it.end] = r; n++; } }
  if (n || !fs.existsSync(pf)) fs.writeFileSync(pf, JSON.stringify(p));
  return p;
}

function report(sym, cik, p) {
  const cf = path.join(DD, cik + '.cf.json.gz'); if (!fs.existsSync(cf)) return [];
  const ff = path.join(DD, cik + '.face.json'), f0 = fs.existsSync(ff) ? JSON.parse(fs.readFileSync(ff, 'utf8')) : null;
  let s; try { s = F.normalizeSec(gz(cf), [], f0 && !f0.err ? f0 : null); } catch (e) { return []; }
  if (!s || !s.Q || !s.Q.eps) return [];
  const before = { sh: (s.Q.sh || []).slice(), eps: s.Q.eps.slice() }, est0 = (s.shEst || []).slice();
  const out = [];
  // המפענח מול XBRL: רבעון רביעי שה־10-K כן תייג (לא הערכה)
  for (const r of Object.values(p)) {
    if (!r.rows) { out.push({ sym, e: r.end, kind: 'err', err: r.err }); continue; }
    const i = s.q.findIndex((x) => Math.abs(Date.parse(x) - Date.parse(r.end)) <= 5 * 864e5);
    if (i < 0 || est0.includes(s.q[i]) || !(s.Q.sh && s.Q.sh[i] > 0) || s.Q.eps[i] == null) continue;
    const ni = s.Q.nic && s.Q.nic[i] != null ? s.Q.nic[i] : s.Q.ni && s.Q.ni[i];
    if (ni == null) continue;
    const post = (s.splitsUsed || []).filter(([d]) => d > r.filed).reduce((t, [, x]) => t * x, 1);
    const m = P.q4From(r.rows, ni, s.Q.sh[i], post);
    out.push({ sym, e: s.q[i], kind: 'xbrl', ok: !!m && Math.abs(m.eps - s.Q.eps[i]) < 0.005 && Math.abs(m.sh / s.Q.sh[i] - 1) < 0.002, ours: [s.Q.eps[i], s.Q.sh[i]], pr: m && [m.eps, m.sh] });
  }
  const ch = F.q4Press(s, p);
  for (const e of est0) {
    if (!s.fy.some((f) => Math.abs(Date.parse(f) - Date.parse(e)) <= 5 * 864e5)) continue;
    const i = s.q.indexOf(e), hasPr = Object.values(p).some((r) => r.rows && Math.abs(Date.parse(r.end) - Date.parse(e)) <= 5 * 864e5);
    out.push({ sym, e, kind: 'est', hasPr, hit: ch.some((c) => c.p === e), eps: [before.eps[i], s.Q.eps[i]], sh: [before.sh[i], s.Q.sh[i]] });
  }
  return out;
}

(async () => {
  const seen = new Set(), queue = rows.filter(([s, c]) => (!only || only.has(s)) && !seen.has(pad(c)) && seen.add(pad(c)));
  const all = [];
  let done = 0;
  await Promise.all(Array.from({ length: +(o.par || 4) }, async () => {
    while (queue.length) {
      const [s, c] = queue.shift();
      try { const p = await fetchOne(pad(c)); if (p) all.push(...report(s, pad(c), p)); } catch (e) { console.log(s, 'נכשל', e.message); }
      if (++done % 25 === 0) console.log(done, 'חברות · בקשות', nReq);
    }
  }));
  fs.writeFileSync(path.join(PD, '_res.json'), JSON.stringify(all));
  const T = { est: 0, estPr: 0, hit: 0, epsCh: 0, xbrl: 0, xbrlOk: 0, err: {} };
  for (const r of all) {
    if (r.kind === 'err') T.err[r.err] = (T.err[r.err] || 0) + 1;
    else if (r.kind === 'xbrl') { T.xbrl++; if (r.ok) T.xbrlOk++; }
    else { T.est++; if (r.hasPr) T.estPr++; if (r.hit) T.hit++; if (r.eps[0] !== r.eps[1]) T.epsCh++; }
  }
  console.log(JSON.stringify(T), '· בקשות:', nReq);
})();
