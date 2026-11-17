#!/usr/bin/env node
/* בדיקת העומק של גרף הנרות — שלב 2: מודל התצוגה ("מה המסך מציג").
   chartlib.js נטען ב־vm (כמו tests/chart.test.js) ומריץ בדיוק את מה שהטלפון מריץ:
     fromColumns(עמוד 0) → לכל עמוד ישן: fromColumns(...).filter(< הנר הראשון) ומחובר מלפנים (fetchOlder)
     → aggregate(raw, tf) לכל אחד מ־18 המרווחים שהבסיס שלהם צולם (display() ב־chart.js).
   הפלט נקרא ב־compare.py (קוד אחר, שפה אחרת) מול המקורות.
   שימוש: node tools/chart-deep/model.js --out <dir> [--syms AAPL,NVDA]
   קלט: <out>/snap/<SYM>/<iv>.<pre>.p<k>.json · פלט: <out>/disp/<SYM>/<tf>.<pre>.json = { tf, base, pre, tz, cur, ex, pages, at (זמן הצילום, ms), endErr?, bars:[[t,o,h,l,c,v]] } */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function loadLib() {
  const src = fs.readFileSync(path.join(ROOT, 'chartlib.js'), 'utf8');
  const sb = { console, Date, Math, JSON, Map, Set, WeakMap, Array, Number, Infinity, isFinite, Object };
  vm.createContext(sb);
  vm.runInContext(src.replace(/^export (async )?(function|const)/gm, '$1$2') + '\n;globalThis.L = _test; globalThis.TFX = TF;', sb);
  return { L: sb.L, TF: sb.TFX };
}

/* העמודים שצולמו → raw כמו בטלפון. מחזיר { raw, meta, pages } */
function buildRaw(L, dir, iv, pre) {
  let raw = [], meta = null, k = 0;
  for (; ; k++) {
    const f = path.join(dir, iv + '.' + pre + '.p' + k + '.json');
    if (!fs.existsSync(f)) break;
    const rec = JSON.parse(fs.readFileSync(f, 'utf8')), r = rec.res;
    if (!r || !r.ok) { if (k > 0 && meta) meta.endErr = (r && r.error) || 'fail'; break; }   // עמוד היסטוריה שנכשל — כמו c.err בטלפון
    if (k === 0) { raw = L.fromColumns(r); meta = { tz: r.tz, cur: r.cur, ex: r.ex, name: r.name, more: r.more, at: rec.at }; continue; }
    if (!raw.length) break;
    const b = L.fromColumns(r).filter((x) => x.timestamp < raw[0].timestamp);
    raw = b.concat(raw);
  }
  return { raw, meta, pages: k };
}

const pack = (bars) => bars.map((b) => [Math.round(b.timestamp / 1000), b.open, b.high, b.low, b.close, b.volume]);

function modelSym(lib, out, sym) {
  const dir = path.join(out, 'snap', sym), od = path.join(out, 'disp', sym);
  if (!fs.existsSync(dir)) return 0;
  fs.mkdirSync(od, { recursive: true });
  let n = 0;
  for (const tf of Object.keys(lib.TF)) {
    const base = lib.TF[tf].base;
    for (const pre of [0, 1]) {
      if (pre && !/m$/.test(base)) continue;
      const { raw, meta, pages } = buildRaw(lib.L, dir, base, pre);
      if (!meta) continue;
      const disp = lib.L.aggregate(raw, tf);
      fs.writeFileSync(path.join(od, tf + '.' + pre + '.json'), JSON.stringify(Object.assign({ sym, tf, base, pre, pages }, meta, { bars: pack(disp) })));
      n++;
    }
  }
  return n;
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
  const out = arg('out');
  if (!out) { console.error('חסר --out'); process.exit(2); }
  const syms = arg('syms') ? arg('syms').split(',') : fs.readdirSync(path.join(out, 'snap'));
  const lib = loadLib();
  let n = 0;
  for (const s of syms) n += modelSym(lib, out, s.toUpperCase());
  console.log('קבצי תצוגה:', n);
}

if (require.main === module) main();
module.exports = { loadLib, buildRaw, modelSym };
