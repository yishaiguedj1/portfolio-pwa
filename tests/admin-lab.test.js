/* מ׳6 (20/10/2026): מעבדת השיפור במרכז הניהול — כל קוד מסקנה שהשרתון מחשב (insights ב־lib/studiolearn.js) חייב במסך
   שם ו"מה לעשות" בשתי השפות; ו־op 'learn' מחזיר את סיכום האיסוף המלא (רק ספירות, בלי לפתוח פריטים) */
const fs = require('fs');
const path = require('path');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0, fail = 0;
const ok = (c, m) => { n++; if (c) console.log('ok - ' + m); else { fail++; console.log('FAIL - ' + m); } };
const lrn = R('ibkr-proxy/lib/studiolearn.js'), adm = R('admin-app.js'), app = R('app.js');
const codes = [...new Set([...lrn.matchAll(/out\.push\(\{ k: '([a-z_]+)'/g)].map((m) => m[1]))];
ok(codes.length >= 20, 'נמצאו קודי המסקנות בשרתון (' + codes.length + ')');
const { INS_HE } = require('../ibkr-proxy/lib/studiolearn.js');
for (const k of codes) {
  ok(INS_HE[k], 'INS_HE (החבילה ל־Claude) מכיר את ' + k);
  ok(adm.includes("case '" + k + "': return t('admI_" + k + "');") && adm.includes("case '" + k + "': return t('admA_" + k + "');"), 'במסך שם ומה לעשות: ' + k);
  ok((app.match(new RegExp('admI_' + k + ': "', 'g')) || []).length === 2 && (app.match(new RegExp('admA_' + k + ': "', 'g')) || []).length === 2, 'מחרוזות בעברית ובאנגלית: ' + k);
}
const api = R('ibkr-proxy/api/studio.js');
ok(/async function devView\(deps, now\)[\s\S]{0,400}DL\.devStats\(await R2\.list\(/.test(api) && !/async function devView[\s\S]{0,400}vault\.open/.test(api), 'devView — רק ספירות מהרשימה, בלי לפתוח פריט');
ok(/insL: LR\.INS_HE, synced: wrote, corpus, dev, now/.test(api), "op 'learn' מחזיר את dev");
ok(!/fetch\(|XMLHttpRequest/.test(adm.slice(adm.indexOf('/* ---- מעבדת השיפור (מ׳6'))), 'המעבדה רק מציגה — בלי פנייה לרשת משלה');
{ /* טעות הצפי (21/10/2026) */
  const LRx = require('../ibkr-proxy/lib/studiolearn.js');
  const mk = (run, ept) => ({ k: 'tr', st: 'done', fires: 1, t: { run, pz: 0, s: {} }, ep: { t: ept } });
  const k30 = { ok: null, fin: 0 };
  const off = LRx.insights([mk(1000, 600), mk(1200, 700), mk(900, 600), mk(1300, 800)], k30, [], [], [], { n: 0, c: [] }, { n: 0, m: [] }, [], Date.now(), null, null);
  ok(off.some((x) => x.k === 'eta_off' && x.sev === 2), 'eta_off — צפי רחוק ב־50%+ = חומרה 2');
  const good = LRx.insights([mk(1000, 950), mk(1200, 1150), mk(900, 920), mk(1300, 1250)], k30, [], [], [], { n: 0, c: [] }, { n: 0, m: [] }, [], Date.now(), null, null);
  ok(!good.some((x) => x.k === 'eta_off'), 'eta_off — צפי מדויק = בלי תובנה');
  const rv = (n, u) => ({ k: 'tr', st: 'done', t: { run: 1, pz: 0, s: {} }, lx: { en: { rvn: n, rvu: u } } });
  const un = LRx.insights([rv(600, 70), rv(600, 0)], k30, [], [], [], { n: 0, c: [] }, { n: 0, m: [] }, [], Date.now(), null, null);
  ok(un.some((x) => x.k === 'rv_unrev' && x.v.n === 70 && x.v.j === 1), 'rv_unrev — 70 כתוביות בלי ביקורת בעבודה אחת');
}
console.log(fail ? `\n${fail} מתוך ${n} נכשלו` : `\nכל ${n} הבדיקות עברו ✓`);
process.exit(fail ? 1 : 0);
