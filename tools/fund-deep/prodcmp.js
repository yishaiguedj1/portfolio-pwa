#!/usr/bin/env node
// בדיקת העומק, גל 4 — באיזה מסלול נמצא החוב בייצור: הצילום (`snap.js` ← <w>/disp) מול `normalizeSec` של גרסה מקומית (בדרך כלל main),
// עם המאזן של כל הגשה (bsf, ‏<w>/bsf) ובלעדיו. ‏bsf = הייצור כבר קורא את המאזנים; ‏face = עוד במסלול הישן (עבודת הרקע בשרת לא הגיעה
// לחברה); ‏same = שתי הגרסאות זהות; ‏mixed / none — לבדוק. נתונים ציבוריים של SEC בלבד.
//   node tools/fund-deep/prodcmp.js <w> <fundamentals.js> [--keys debt,int,pretax] [--out <קובץ>]   → <w>/prodcmp.json
// גל 8: ‏--keys — כל מדד ברבעונים (ברירת מחדל: החוב). דף הרווח והפסד של כל 10-Q (F20 ברבעונים, F29, ‏F33) מגיע לייצור רק דרך
// עבודת הרקע — כך רואים לכל חברה אם הסבב בשרת כבר הגיע אליה (bsf) או שעוד לא (face). השורות: [סימבול, מסלול, a, b, both, none, מדד]
'use strict';
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const AR = process.argv.slice(2), opt = (k, d) => { const i = AR.indexOf('--' + k); return i < 0 ? d : AR[i + 1]; };
const [W, FS] = AR.filter((x, i) => !x.startsWith('--') && !(i > 0 && AR[i - 1].startsWith('--')));
const KEYS = String(opt('keys', 'debt')).split(',');
const F = require(path.resolve(FS));
const rows = fs.readFileSync(path.join(__dirname, 'ciks.tsv'), 'utf8').split('\n').map((l) => l.split(/\s+/)).filter((p) => p[1] && /^\d+$/.test(p[1]));
const near = (a, b) => a != null && b != null && Math.abs(a - b) <= Math.max(1e6, 0.005 * Math.abs(b));
const T = {}, out = [];
for (const [sym, c] of rows) {
  const cik = c.padStart(10, '0'), dp = path.join(W, 'disp', sym + '.json'), cf = path.join(W, 'debt', cik + '.cf.json.gz'), bf = path.join(W, 'bsf', cik + '.json');
  if (!fs.existsSync(dp) || !fs.existsSync(cf)) continue;
  if (!fs.existsSync(bf)) { T.nobsf = (T.nobsf || 0) + 1; continue; }
  const d = JSON.parse(fs.readFileSync(dp)), facts = JSON.parse(zlib.gunzipSync(fs.readFileSync(cf)));
  const ff = path.join(W, 'debt', cik + '.face.json'), f0 = fs.existsSync(ff) ? JSON.parse(fs.readFileSync(ff)) : null, face = f0 && !f0.err ? f0 : null;
  let a, b; try { a = F.normalizeSec(facts, [], face, JSON.parse(fs.readFileSync(bf))); b = F.normalizeSec(facts, [], face, null); } catch (e) { continue; }
  if (!a || !b) continue;
  for (const key of KEYS) {
  const pr = d.raw && d.raw.Q && d.raw.Q[key], qs = d.raw && d.raw.q;
  if (!pr || !qs) continue;
  let na = 0, nb = 0, both = 0, none = 0;
  qs.forEach((e, i) => {
    const p = pr[i];
    const ja = a.q.indexOf(e), jb = b.q.indexOf(e);
    const va = ja >= 0 && a.Q[key] ? a.Q[key][ja] : null, vb = jb >= 0 && b.Q[key] ? b.Q[key][jb] : null;
    if (p == null && (key === 'debt' || (va == null && vb == null))) return; // החוב — רק מה שמוצג; שאר המדדים — גם ריק מול ערך (q4drop)
    const eq = (x, y) => (x == null && y == null) || near(x, y);
    const ma = eq(p, va), mb = eq(p, vb);
    if (ma && mb) both++; else if (ma) na++; else if (mb) nb++; else none++;
  });
  const k = na > 0 && nb === 0 ? 'bsf' : nb > 0 && na === 0 ? 'face' : na === 0 && nb === 0 ? (none ? 'none' : 'same') : 'mixed';
  const tk = KEYS.length > 1 ? key + ':' + k : k;
  T[tk] = (T[tk] || 0) + 1; out.push([sym, k, na, nb, both, none, key]);
  }
}
console.log(JSON.stringify(T));
fs.writeFileSync(opt('out', path.join(W, 'prodcmp.json')), JSON.stringify(out));
for (const r of out.filter((r) => r[1] === 'face' || r[1] === 'mixed').slice(0, 30)) console.log(...r);
