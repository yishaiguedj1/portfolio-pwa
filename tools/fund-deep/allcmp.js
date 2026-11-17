#!/usr/bin/env node
// בדיקת העומק — "לפני/אחרי" של כלל חדש על כל היקום: normalizeSec של שתי גרסאות (companyfacts מהמטמון של debt.js fetch),
// כמה ערכים השתנו בכל שדה (שנתי / רבעוני), ורשימת השינויים לקובץ. נתונים ציבוריים של SEC בלבד.
//   node tools/fund-deep/allcmp.js --w <dir> --old <fundamentals.js> [--new <fundamentals.js>] [--only AAPL,LUV] [--keys eps,ni] [--bsf]
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '../..');
const argv = process.argv.slice(2), o = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const k = argv[i].slice(2), v = argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  o[k] = v;
}
if (!o.w || !o.old) { console.error('שימוש: --w <dir> --old <fundamentals.js> [--new …]'); process.exit(2); }
const W = path.resolve(o.w), DD = path.join(W, 'debt');
const A = require(path.resolve(o.old)), B = require(path.resolve(o.new || path.join(ROOT, 'ibkr-proxy/lib/fundamentals.js')));
const gz = (f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());
const only = o.only && o.only !== true ? new Set(String(o.only).split(',')) : null;
const keys = o.keys && o.keys !== true ? new Set(String(o.keys).split(',')) : null;
const rows = fs.readFileSync(path.join(__dirname, 'ciks.tsv'), 'utf8').split('\n').map((l) => l.split(/\s+/)).filter((p) => p[1] && /^\d+$/.test(p[1]));
const same = (x, y) => x === y || (x != null && y != null && Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x)));
const cnt = {}, list = [], seen = new Set();
let n = 0, err = 0;
for (const [sym, c0] of rows) {
  const cik = c0.padStart(10, '0');
  if (seen.has(cik) || (only && !only.has(sym))) continue;
  seen.add(cik);
  const f = path.join(DD, cik + '.cf.json.gz'); if (!fs.existsSync(f)) continue;
  let facts = gz(f);
  const prev = B.CIK_PREV && B.CIK_PREV[cik];
  if (prev && fs.existsSync(path.join(DD, prev + '.cf.json.gz'))) facts = B.mergeFacts(gz(path.join(DD, prev + '.cf.json.gz')), facts);
  const ff = path.join(DD, cik + '.face.json'), f0 = fs.existsSync(ff) ? JSON.parse(fs.readFileSync(ff, 'utf8')) : null, face = f0 && !f0.err ? f0 : null;
  const bf = o.bsf && fs.existsSync(path.join(W, 'bsf', cik + '.json')) ? JSON.parse(fs.readFileSync(path.join(W, 'bsf', cik + '.json'), 'utf8')) : null;
  let a, b;
  try { a = A.normalizeSec(facts, [], face, bf); b = B.normalizeSec(facts, [], face, bf); } catch (e) { err++; continue; }
  n++;
  for (const [P, per] of [['A', 'fy'], ['Q', 'q']]) {
    const ks = new Set([...Object.keys(a[P] || {}), ...Object.keys(b[P] || {})]);
    for (const k of ks) {
      if (keys && !keys.has(k)) continue;
      const ends = new Set([...(a[per] || []), ...(b[per] || [])]);
      for (const e of ends) {
        const i = (a[per] || []).indexOf(e), j = (b[per] || []).indexOf(e);
        const x = i >= 0 && a[P][k] ? a[P][k][i] : null, y = j >= 0 && b[P][k] ? b[P][k][j] : null;
        if (same(x ?? null, y ?? null)) continue;
        cnt[P + '.' + k] = (cnt[P + '.' + k] || 0) + 1;
        list.push([sym, P, k, e, x, y]);
      }
    }
  }
}
console.log('חברות:', n, '· נכשלו:', err, '· שינויים:', list.length);
console.log(Object.entries(cnt).sort((p, q) => q[1] - p[1]).map((x) => x.join(':')).join(' '));
const by = {}; for (const l of list) by[l[0]] = (by[l[0]] || 0) + 1;
console.log('לפי חברה:', Object.entries(by).sort((p, q) => q[1] - p[1]).slice(0, 25).map((x) => x.join(':')).join(' '));
fs.writeFileSync(path.join(W, 'allcmp.json'), JSON.stringify(list));
