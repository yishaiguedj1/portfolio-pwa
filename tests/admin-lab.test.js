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
console.log(fail ? `\n${fail} מתוך ${n} נכשלו` : `\nכל ${n} הבדיקות עברו ✓`);
process.exit(fail ? 1 : 0);
