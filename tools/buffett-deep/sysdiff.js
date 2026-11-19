#!/usr/bin/env node
/* בדיקת העומק של מכפיל באפט — ההיקף של תיקון מוצע במסווג (docs/buffett-pe-audit.md, ‏B-025).
   מריץ את secsbc.classify הנוכחי ועותק מתוקן על אותו טקסט שהשרת קורא (sysEx מהמטמון של prfetch.js, בלי רשת),
   ומדפיס אילו הודעות משנות סימנים ואילו משנות את ההחלטה (ex).
   שימוש: node tools/buffett-deep/sysdiff.js <BD_DIR> <נתיב לעותק של secsbc.js>
   (בעותק: require('./secpr') → נתיב מלא ל־ibkr-proxy/lib/secpr). פלט: diff.jsonl ליד העותק. */
'use strict';
const fs = require('fs'), path = require('path');
const A = require('../../ibkr-proxy/lib/secsbc');
const B = require(process.argv[3]);
const BD = process.argv[2], CACHE = path.join(BD, 'cache');
const fileOf = (cik, acc, nm) => path.join(CACHE, 'www.sec.gov', 'Archives', 'edgar', 'data', String(+cik), acc.replace(/-/g, ''), nm);
const out = [];
for (const fn of fs.readdirSync(path.join(BD, 'pr')).sort()) {
  const m = JSON.parse(fs.readFileSync(path.join(BD, 'pr', fn), 'utf8'));
  for (const it of m.items) {
    if (!it.got) continue;
    let t = '';
    for (const nm of it.sysEx) { const f = fileOf(m.cik, it.acc, nm); if (fs.existsSync(f)) t += ' ' + A.text(fs.readFileSync(f, 'utf8')); }
    const a = A.classify(t), b = B.classify(t);
    if (a.ex !== b.ex || a.h !== b.h) {
      const i = t.search(/acquisition[- ]related(?:\s+(?:cash|costs?))?(?:\s*(?:and|&|,)\s*)?(?:stock|share|equity)[- ]?based/);
      out.push({ sym: m.sym, acc: it.acc, filed: it.filed, picked: !!it.sys, er: a.er, exA: a.ex, exB: b.ex, hA: a.h.slice(0, 30), hB: b.h.slice(0, 30), ctx: i >= 0 ? t.slice(i, i + 140) : '' });
    }
  }
}
fs.writeFileSync(path.join(path.dirname(process.argv[3]), 'diff.jsonl'), out.map((o) => JSON.stringify(o)).join('\n') + '\n');
const flip = out.filter((o) => o.exA !== o.exB);
console.log('הודעות שהסימנים השתנו: ' + out.length + ' · ex התהפך: ' + flip.length + ' · חברות: ' + [...new Set(flip.map((o) => o.sym))].join(','));
