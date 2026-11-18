#!/usr/bin/env node
// בדיקת העומק — החוב (F7, ‏docs/research/fund-deep/wave-1.md): הורדה, "לפני/אחרי" על כל היקום מול החוב שמודפס במאזן, ודיבאג לחברה.
// נתונים ציבוריים של SEC בלבד; הכל בתיקיית העבודה (--w <dir>/debt), לא בריפו.
//   node tools/fund-deep/debt.js fetch --w <dir> [--ciks tools/fund-deep/ciks.tsv] [--par 6]   companyfacts + submissions + המאזן (secFace)
//   python3 -I tools/fund-deep/debt_exp.py --db <dir>/fsds.db --w <dir>                         הצפוי (FSDS) → <dir>/debt/exp.json
//   node tools/fund-deep/debt.js cmp  --w <dir> --old <fundamentals.js> [--new <fundamentals.js>] [--only PH,MCK] [--tag X] [--bsf] [--bsf-old]  (--bsf: המאזן של כל הגשה, bsf.js, לחדשה; ‏--bsf-old: גם לישנה — מפעיל גם את --bsf)
//   node tools/fund-deep/debt.js diff --w <dir> --sym PH --old <fundamentals.js> [--new …]     התאריכים שבהם שתי הגרסאות שונות, והצפוי
//   node tools/fund-deep/debt.js tags --w <dir> --sym PH --tags LongTermDebtCurrent,CommercialPaper [--from 2012-01-01]
//   node tools/fund-deep/debt.js find --w <dir> --sym INVH --end 2020-12-31 --v 402 [--tol 0.03]   תגיות שהערך שלהן קרוב (במיליונים)
// ‏--old/--new: נתיב ל־ibkr-proxy/lib/fundamentals.js (עם הקבצים שלידו) — למשל worktree של main: ‏git worktree add <dir>/main origin/main
'use strict';
const fs = require('fs'), zlib = require('zlib'), path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2), cmd = argv[0], o = {};
for (let i = 1; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const k = argv[i].slice(2), v = argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  o[k] = v;
}
if (!['fetch', 'cmp', 'diff', 'tags', 'find'].includes(cmd) || !o.w) {
  console.error('שימוש: fetch | cmp | diff | tags | find, עם --w <תיקיית עבודה> (פירוט בראש הקובץ)');
  process.exit(2);
}
const D = path.join(path.resolve(o.w), 'debt');
fs.mkdirSync(D, { recursive: true });
const pad = (c) => String(c).padStart(10, '0');
const rows = fs.readFileSync(o.ciks || path.join(__dirname, 'ciks.tsv'), 'utf8').split('\n').map((l) => l.split(/\s+/)).filter((p) => p[1] && /^\d+$/.test(p[1]));
const cikOf = Object.fromEntries(rows.map(([s, c]) => [s, pad(c)]));
const mod = (f) => require(path.resolve(f || path.join(ROOT, 'ibkr-proxy/lib/fundamentals.js')));
const gz = (f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());
const cfF = (cik) => path.join(D, cik + '.cf.json.gz'), subF = (cik) => path.join(D, cik + '.sub.json.gz'), faceF = (cik) => path.join(D, cik + '.face.json');
const M = (v) => (v == null ? '-' : Math.round(v / 1e6));

// העובדות (כולל CIK קודם של אותה חברה — CIK_PREV) והמאזן המודפס של ההגשה השנתית האחרונה
function load(F, cik) {
  let facts = gz(cfF(cik));
  const prev = F.CIK_PREV && F.CIK_PREV[cik];
  if (prev && fs.existsSync(cfF(prev))) facts = F.mergeFacts(gz(cfF(prev)), facts);
  const f0 = fs.existsSync(faceF(cik)) ? JSON.parse(fs.readFileSync(faceF(cik), 'utf8')) : null;
  return { facts, face: f0 && !f0.err ? f0 : null };
}
const expAll = () => {
  const f = path.join(D, 'exp.json');
  if (!fs.existsSync(f)) { console.error('חסר ' + f + ' — להריץ קודם את debt_exp.py'); process.exit(2); }
  return JSON.parse(fs.readFileSync(f, 'utf8'));
};

async function fetchAll() {
  const F = mod(o.new);
  const UA = { headers: { 'User-Agent': 'TheSnowball/1.0 data@thesnowball.app' } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const get = async (url) => {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(url, UA);
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.text();
      } catch (e) { if (i === 3) throw e; await sleep(2000 * (i + 1)); }
    }
  };
  const cf = async (cik) => {
    if (fs.existsSync(cfF(cik))) return;
    const t = await get('https://data.sec.gov/api/xbrl/companyfacts/CIK' + cik + '.json');
    if (t) fs.writeFileSync(cfF(cik), zlib.gzipSync(t));
    await sleep(300);
  };
  const seen = new Set(), queue = rows.filter(([, c]) => !seen.has(pad(c)) && seen.add(pad(c)));
  const one = async (sym, c) => {
    const cik = pad(c);
    try {
      await cf(cik);
      if (F.CIK_PREV && F.CIK_PREV[cik]) await cf(F.CIK_PREV[cik]);
      let sub = null;
      if (fs.existsSync(subF(cik))) sub = gz(subF(cik));
      else {
        const t = await get('https://data.sec.gov/submissions/CIK' + cik + '.json');
        if (t) { fs.writeFileSync(subF(cik), zlib.gzipSync(t)); sub = JSON.parse(t); }
        await sleep(300);
      }
      if (!fs.existsSync(faceF(cik)) && sub) {
        const face = await F.secFace(cik, sub).catch((e) => ({ err: String(e.message || e).slice(0, 60) }));
        fs.writeFileSync(faceF(cik), JSON.stringify(face || null));
        await sleep(300);
      }
      console.log(sym, 'ok');
    } catch (e) { console.log(sym, 'נכשל', String(e.message || e).slice(0, 80)); }
  };
  await Promise.all(Array.from({ length: +(o.par || 6) }, async () => { while (queue.length) { const [s, c] = queue.shift(); await one(s, c); } }));
  console.log('סיום');
}

// לפני/אחרי: כל תאריך מאזן (שנתי ורבעוני) של כל חברה, מול החוב שמודפס בהגשה השנתית האחרונה (exp.json)
function cmpAll() {
  const OLD = mod(o.old), NEW = mod(o.new), EXP = expAll();
  const only = o.only && o.only !== true ? o.only.split(',') : [];
  const close = (a, b) => Math.abs(a - b) <= Math.max(1.5e6, 0.005 * Math.abs(b));
  const day = (s) => Date.parse(s + 'T00:00:00Z') / 864e5;
  const tot = { old: { ok: 0, bad: 0, miss: 0, xtra: 0 }, new: { ok: 0, bad: 0, miss: 0, xtra: 0 } };
  const better = [], worse = [], stillBad = [];
  let inc = 0;
  for (const [cik0, ex] of Object.entries(EXP)) {
    if (only.length && !only.includes(ex.sym)) continue;
    const cik = pad(cik0);
    if (!fs.existsSync(cfF(cik))) continue;
    let a, b;
    try {
      const L = load(NEW, cik);
      // --bsf: המאזן של כל הגשה (bsf.js fetch → <w>/bsf/<CIK>.json) לגרסה החדשה — כמו בייצור (lib/bsfiled.js).
      // ‏--bsf-old: גם לישנה (גל 4) — כששתי הגרסאות קוראות את המאזנים, "הורע: 0" בלי הדגל לא אומר כלום (לקח גל 3)
      const bff = path.join(path.resolve(o.w), 'bsf', cik + '.json'), useB = o.bsf || o['bsf-old'];
      const bfs = useB && fs.existsSync(bff) ? fs.readFileSync(bff, 'utf8') : null;
      const bf = bfs && JSON.parse(bfs), bfo = bfs && o['bsf-old'] ? JSON.parse(bfs) : undefined; // עותק נפרד — normalizeSec לא ישתף מצב
      a = OLD.normalizeSec(L.facts, [], L.face, bfo); b = NEW.normalizeSec(L.facts, [], L.face, bf);
    } catch (e) { console.log(ex.sym, 'שגיאה', e.message); continue; }
    if (!a || !b) continue;
    const diffs = [];
    for (const [P, per] of [['A', 'fy'], ['Q', 'q']]) {
      const va = new Map((a[per] || []).map((e, i) => [e, a[P].debt ? a[P].debt[i] : null]));
      const vb = new Map((b[per] || []).map((e, i) => [e, b[P].debt ? b[P].debt[i] : null]));
      for (const e of new Set([...va.keys(), ...vb.keys()])) {
        const k = Object.keys(ex.d).find((d) => Math.abs(day(d) - day(e)) <= 3); // אותו יום או עד 3 ימים (סוף שבוע)
        if (k && ex.d[k][3]) { inc++; continue; } // צפוי חלקי — שורת חוב בלי ערך בלי ממד
        const x = k ? ex.d[k][0] : null, alt = k ? ex.d[k][1] : [];
        const st = (v) => (x == null ? (v == null ? null : 'xtra') : v == null ? 'miss' : close(v, x) || alt.some((y) => close(v, y)) ? 'ok' : 'bad');
        const so = st(va.get(e)), sn = st(vb.get(e));
        if (so) tot.old[so]++;
        if (sn) tot.new[sn]++;
        if (so !== sn) diffs.push([P, e, va.get(e), vb.get(e), x, so, sn]);
        else if (sn === 'bad' && P === 'A') stillBad.push([ex.sym, e, vb.get(e), x, ex.d[k][2]]);
      }
    }
    const sc = { ok: 2, xtra: 1, miss: 0, bad: -1 };
    const d = diffs.reduce((t, r) => t + (sc[r[6]] ?? 0) - (sc[r[5]] ?? 0), 0);
    // ההרעות קודם (בחברה שהורעה) — כדי שהשורות המודפסות יהיו אלה שצריך לבדוק (Seagate: 4 שיפורים הסתירו את ההרעות)
    const dd = (r) => (sc[r[6]] ?? 0) - (sc[r[5]] ?? 0);
    if (d < 0) diffs.sort((a, b) => dd(a) - dd(b));
    if (diffs.length) (d >= 0 ? better : worse).push([ex.sym, d, diffs.slice(0, 4).map((r) => [r[0], r[1], M(r[2]), M(r[3]), M(r[4]), r[5], r[6]].join(' ')).join(' | ')]);
  }
  console.log('ישן:', JSON.stringify(tot.old), 'צפוי חלקי:', inc);
  console.log('חדש:', JSON.stringify(tot.new));
  console.log('\nהשתפר:', better.length);
  for (const r of better) console.log('  +', r[0], r[1], r[2]);
  console.log('\nהורע:', worse.length);
  for (const r of worse) console.log('  -', r[0], r[1], r[2]);
  fs.writeFileSync(path.join(D, 'stillbad' + (o.tag && o.tag !== true ? o.tag : '') + '.json'), JSON.stringify(stillBad));
  console.log('\nשנים שגויות בשתי הגרסאות:', stillBad.length);
}

function cikArg() {
  const cik = cikOf[o.sym];
  if (!cik) { console.error('סימבול לא ב־ciks.tsv: ' + o.sym); process.exit(2); }
  return cik;
}

// שתי גרסאות לחברה אחת: שורות החוב במאזן של היום, וכל תאריך שבו החוב שונה — עם הצפוי (במיליונים)
function diffOne() {
  const A = mod(o.old), B = mod(o.new), cik = cikArg(), L = load(B, cik);
  const ex = Object.values(expAll()).find((x) => x.sym === o.sym) || { d: {} };
  const d = L.face && B.debtFace ? B.debtFace(L.face, 'USD') : null;
  if (d) console.log('שורות:', d.lines.map((l) => `${l.tag}[${l.cat}] "${(l.label || '').slice(0, 50)}"`).join(' ; '));
  const a = A.normalizeSec(L.facts, [], L.face), b = B.normalizeSec(L.facts, [], L.face);
  for (const [P, per] of [['A', 'fy'], ['Q', 'q']]) {
    for (const [i, e] of (b[per] || []).entries()) {
      const j = (a[per] || []).indexOf(e), x = j >= 0 && a[P].debt ? a[P].debt[j] : null, y = b[P].debt ? b[P].debt[i] : null;
      if (x === y) continue;
      const k = ex.d[e];
      console.log(P, e, M(x), '→', M(y), 'צפוי', k ? M(k[0]) + ' ' + JSON.stringify(k[2], (key, v) => (typeof v === 'number' ? M(v) : v)) : '-');
    }
  }
}

// ציר הזמן של תגיות (us-gaap, ערכים מיידיים מ־10-K/10-Q), במיליונים
function tagsOne() {
  const g = gz(cfF(cikArg())).facts['us-gaap'] || {};
  for (const t of String(o.tags || '').split(',').filter(Boolean)) {
    const by = {};
    for (const x of (g[t] && g[t].units.USD) || []) if (!x.start && /^10-[KQ]/.test(x.form) && (!o.from || x.end >= o.from)) by[x.end] = x.val;
    const es = Object.keys(by).sort();
    console.log(t, es.length ? es.map((e) => e.slice(2, 7) + ':' + Math.round(by[e] / 1e6)).join(' ') : '—');
  }
}

// כל התגיות (בכל ה־taxonomies) שהערך המיידי שלהן בתאריך נתון קרוב לסכום מבוקש (במיליונים) — לחיפוש שורה שנעלמה
function findOne() {
  const facts = gz(cfF(cikArg())), T = +o.v * 1e6, tol = (+o.tol || 0.01) * Math.abs(T), out = new Set();
  for (const [ns, g] of Object.entries(facts.facts)) {
    for (const [t, x0] of Object.entries(g)) {
      for (const u of Object.values(x0.units || {})) {
        const x = u.find((y) => !y.start && y.end === o.end && Math.abs(y.val - T) <= tol);
        if (x) out.add(`${ns} ${t} ${Math.round(x.val / 1e5) / 10} ${x.form} ${x.fy}`);
      }
    }
  }
  console.log([...out].sort().join('\n') || '—');
}

if (cmd === 'fetch') fetchAll();
else if (cmd === 'cmp') cmpAll();
else if (cmd === 'diff') diffOne();
else if (cmd === 'tags') tagsOne();
else findOne();
