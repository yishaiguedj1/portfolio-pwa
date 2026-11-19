#!/usr/bin/env node
/* בדיקת העומק של מכפיל באפט — גל 2: מה המסווג של המערכת מחליט על כל הודעה באוסף (docs/buffett-pe-audit.md).
   בדיוק כמו secsbc.readOne: הנספחים ש־SECPR.exhibits בוחר (2 הראשונים; בלי נספח — המסמך הראשי), אותו text() ואותו classify —
   מהמטמון של prfetch.js (בלי פנייה לרשת). ובנוסף — הסיווג על **כל** הנספחים שנשמרו (לבדוק אם הבחירה של 2 נספחים מפספסת).
   פלט: <BD_DIR>/sys.jsonl — שורה לכל הודעה: {sym, cik, acc, filed, form, sys (נבחרה ב־pick), c (הסיווג כמו בשרת), call (על הכל)}
   שימוש: BD_DIR=<dir> node tools/buffett-deep/sysclass.js */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const SBC = require('../../ibkr-proxy/lib/secsbc');

const BD = process.env.BD_DIR || '.';
const CACHE = process.env.BD_CACHE || path.join(BD, 'cache');
const fileOf = (cik, acc, nm) => path.join(CACHE, 'www.sec.gov', 'Archives', 'edgar', 'data', String(+cik), acc.replace(/-/g, ''), nm);
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);

const out = [];
for (const fn of fs.readdirSync(path.join(BD, 'pr')).sort()) {
  const m = JSON.parse(fs.readFileSync(path.join(BD, 'pr', fn), 'utf8'));
  for (const it of m.items) {
    if (!it.got) continue;
    let t = '';
    for (const nm of it.sysEx) { const r = read(fileOf(m.cik, it.acc, nm)); if (r != null) t += ' ' + SBC.text(r); }
    const c = SBC.classify(t);
    let ta = '';
    for (const nm of it.got) { const r = read(fileOf(m.cik, it.acc, nm)); if (r != null) ta += ' ' + SBC.text(r); }
    const ca = SBC.classify(ta);
    out.push(JSON.stringify({ sym: m.sym, cik: +m.cik, acc: it.acc, filed: it.filed, form: it.form, sys: !!it.sys, sysEx: it.sysEx,
      c: { er: c.er, ex: c.ex, fut: c.fut, n: c.n, h: c.h }, call: { er: ca.er, ex: ca.ex, fut: ca.fut, n: ca.n } }));
  }
}
fs.writeFileSync(path.join(BD, 'sys.jsonl'), out.join('\n') + '\n');
console.log('הודעות: ' + out.length + ' · SV=' + SBC.SV);
