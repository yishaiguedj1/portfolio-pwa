#!/usr/bin/env node
// בדיקת העומק, גל 4 — באיזה מסלול נמצא החוב בייצור: הצילום (`snap.js` ← <w>/disp) מול `normalizeSec` של גרסה מקומית (בדרך כלל main),
// עם המאזן של כל הגשה (bsf, ‏<w>/bsf) ובלעדיו. ‏bsf = הייצור כבר קורא את המאזנים; ‏face = עוד במסלול הישן (עבודת הרקע בשרת לא הגיעה
// לחברה); ‏same = שתי הגרסאות זהות; ‏mixed / none — לבדוק. נתונים ציבוריים של SEC בלבד.
//   node tools/fund-deep/prodcmp.js <w> <fundamentals.js> [--keys debt,int,pretax] [--out <קובץ>]   → <w>/prodcmp.json
// גל 8: ‏--keys — כל מדד ברבעונים (ברירת מחדל: החוב). דף הרווח והפסד של כל 10-Q (F20 ברבעונים, F29, ‏F33) מגיע לייצור רק דרך
// עבודת הרקע — כך רואים לכל חברה אם הסבב בשרת כבר הגיע אליה (bsf) או שעוד לא (face). השורות: [סימבול, מסלול, a, b, both, none, מדד]
// גל 8: ‏--xb — כמו בשרתון: ההגשות שעוד לא ב־companyfacts (`secxbrl.patchFacts`, מטמון ב־<w>/xbraw; בלי זה רבעון אחרון שקיים רק
// בייצור נספר none); רבעון שהשרתון מילא מ־Yahoo (`qfill`) — לא משווים. עלות מכר ורווח גולמי בחברה עם זרוע מימון (gpx 'fin') — מ־Yahoo בשרתון, לא משווים.
// תמיד (לא רק ב־‏--xb): ה־CIK הקודם (CIK_PREV) — העובדות, והדוח השנתי כשלישות החדשה אין עדיין (גל 8: XOM — 45 רבעונים ב־none בלי זה).
'use strict';
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const AR = process.argv.slice(2), opt = (k, d) => { const i = AR.indexOf('--' + k); return i < 0 ? d : AR[i + 1]; };
const [W, FS] = AR.filter((x, i) => !x.startsWith('--') && !(i > 0 && AR[i - 1].startsWith('--')));
const KEYS = String(opt('keys', 'debt')).split(',');
const F = require(path.resolve(FS));
const rows = fs.readFileSync(path.join(__dirname, 'ciks.tsv'), 'utf8').split('\n').map((l) => l.split(/\s+/)).filter((p) => p[1] && /^\d+$/.test(p[1]));
const near = (a, b) => a != null && b != null && Math.abs(a - b) <= Math.max(1e6, 0.005 * Math.abs(b));
const T = {}, out = [];
const XB = AR.includes('--xb'), XD = path.join(W, 'xbraw'), UA = { 'User-Agent': 'TheSnowball/1.0 data@thesnowball.app' };
let lastNet = 0;
async function net(u) { // מטמון לכל כתובת; עד ~3 בקשות לשנייה (עבודות אחרות מול SEC רצות במקביל)
  const f = path.join(XD, require('crypto').createHash('sha1').update(u).digest('hex') + '.gz');
  if (fs.existsSync(f)) { const t = zlib.gunzipSync(fs.readFileSync(f)).toString('utf8'); if (t === '\u0000404') throw new Error('404'); return t; }
  const w = lastNet + +opt('xgap', 350) - Date.now(); if (w > 0) await new Promise((r) => setTimeout(r, w)); lastNet = Date.now();
  const r = await fetch(u, { headers: UA });
  if (r.status === 404) { fs.mkdirSync(XD, { recursive: true }); fs.writeFileSync(f, zlib.gzipSync('\u0000404')); throw new Error('404'); }
  if (!r.ok) throw new Error('http ' + r.status);
  const t = await r.text(); fs.mkdirSync(XD, { recursive: true }); fs.writeFileSync(f, zlib.gzipSync(t)); return t;
}
(async () => {
for (const [sym, c] of rows) {
  const cik = c.padStart(10, '0'), dp = path.join(W, 'disp', sym + '.json'), cf = path.join(W, 'debt', cik + '.cf.json.gz'), bf = path.join(W, 'bsf', cik + '.json');
  if (!fs.existsSync(dp) || !fs.existsSync(cf)) continue;
  if (!fs.existsSync(bf)) { T.nobsf = (T.nobsf || 0) + 1; continue; }
  const d = JSON.parse(fs.readFileSync(dp)), gz = (f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
  let facts = gz(cf);
  // הישות הקודמת (CIK_PREV) — תמיד, כמו בשרתון (גל 8: בלי זה XOM — 45 רבעונים ב־none)
  const pv = F.CIK_PREV && F.CIK_PREV[cik], pf = pv && path.join(W, 'debt', pv + '.cf.json.gz');
  if (pf && fs.existsSync(pf)) facts = F.mergeFacts(gz(pf), facts);
  if (XB) {
    const sf = path.join(W, 'debt', cik + '.sub.json.gz');
    if (fs.existsSync(sf)) facts = (await require(path.join(path.dirname(path.resolve(FS)), 'secxbrl')).patchFacts(facts, gz(sf), cik, { merge: F.mergeFacts,
      getText: net, getJson: async (u) => JSON.parse(await net(u)) }).catch(() => ({ facts }))).facts;
  }
  const rf = (k) => { const ff = path.join(W, 'debt', k + '.face.json'), f0 = fs.existsSync(ff) ? JSON.parse(fs.readFileSync(ff)) : null; return f0 && !f0.err ? f0 : null; };
  const face = rf(cik) || (pv ? rf(pv) : null); // כמו בשרתון: בלי דוח שנתי לישות החדשה — הדוח של הקודמת
  let a, b; try { a = F.normalizeSec(facts, [], face, JSON.parse(fs.readFileSync(bf))); b = F.normalizeSec(facts, [], face, null); } catch (e) { continue; }
  if (!a || !b) continue;
  for (const key of KEYS) {
  const pr = d.raw && d.raw.Q && d.raw.Q[key], qs = d.raw && d.raw.q;
  if (!pr || !qs) continue;
  const sn = XB ? JSON.parse(fs.readFileSync(path.join(W, 'snap', sym + '.json'))) : null, qf = new Set((sn && sn.qfill && sn.qfill[key]) || []);
  if (sn && (key === 'cogs' || key === 'gp') && sn.gpx === 'fin') { T.fin = (T.fin || 0) + 1; continue; }
  let na = 0, nb = 0, both = 0, none = 0;
  qs.forEach((e, i) => {
    const p = pr[i];
    if (qf.has(e)) return; // מילוי מ־Yahoo בשרתון (yQuarterFill) — לא מ־SEC
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
})();
