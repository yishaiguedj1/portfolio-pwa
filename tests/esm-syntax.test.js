// esm-syntax.test.js — כל מודול ES בשורש (import/export) עובר בדיקת תחביר כמודול (17/11/2026).
// רקע: 2.166.1 מוזג עם `const d` כפול ב־chart.js (countdown) — המודול לא נטען והגרף לא נפתח, אבל אף בדיקה לא נכשלה:
// הבדיקות טוענות את chartlib.js בלבד, ו־`node --check` על ‎.js‎ לא בודק כמודול. כאן — עותק ‎.mjs‎ לכל קובץ.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const root = path.join(__dirname, '..');
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.error('FAIL ' + m); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'esm-'));
const isEsm = (s) => /^\s*(import\s[^(]|export\s)/m.test(s);
const files = fs.readdirSync(root).filter((f) => f.endsWith('.js') && !f.endsWith('.min.js'));
let mods = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  if (!isEsm(src)) continue;
  mods++;
  const dst = path.join(tmp, f.replace(/\.js$/, '.mjs'));
  fs.writeFileSync(dst, src);
  const r = cp.spawnSync(process.execPath, ['--check', dst], { encoding: 'utf8' });
  ok(r.status === 0, f + ': ' + String(r.stderr || '').split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 300));
}
ok(mods >= 3 && files.includes('chart.js'), 'נמצאו מודולים (chart.js ביניהם)');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`esm-syntax: ${n - bad}/${n}`);
process.exit(bad ? 1 : 0);
