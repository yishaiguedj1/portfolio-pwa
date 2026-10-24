/* 24/10/2026: בדיקת קישור בשרת לא חזרה בזמן בייצור (המשתמש: "השרת לא ענה בזמן" אחרי 150 שנ׳). העובד שואל את Vercel
   והטלפון את api.thesnowball.app — הסריקה של התור הייתה פעם בדקה. התיקון: הטלפון מחכה 5 דק׳ ואומר אם אף שרת לא לקח,
   השרתון סורק כל 20 שנ׳, והעובד מדווח במדדים מה השרתון ענה לו (pq) וכמה בדיקות טופלו (pqn) */
const fs = require('fs');
const path = require('path');
const D = require('../ibkr-proxy/lib/devlog.js');
let n = 0, fail = 0;
const ok = (c, m) => { n++; if (c) console.log('ok - ' + m); else { fail++; console.log('FAIL - ' + m); } };
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const st = R('studio.js'), api = R('ibkr-proxy/api/studio.js'), ag = R('translator/agent.py'), app = R('app.js');
ok(/LINK_WAIT_MS = 300e3/.test(st), 'הטלפון מחכה לבדיקה בשרת 5 דק׳');
ok(/j\.probe\.st === 'q' \? 'no_take' : 'timeout'/.test(st) && /case 'no_take': return T\('studioLinkENoTake'\)/.test(st), 'בדיקה שאף שרת לא לקח — הודעה משלה');
ok((app.match(/studioLinkENoTake: "/g) || []).length === 2, 'המחרוזת בעברית ובאנגלית');
ok(/const PROBE_SCAN_MS = 20e3;/.test(api) && /now - probeScan < PROBE_SCAN_MS/.test(api), 'השרתון סורק את התור כל 20 שנ׳');
ok(/'pq': PQ_ST or None, 'pqn': PQ_N or None/.test(ag) && /PQ_N \+= 1/.test(ag), 'העובד שולח במדדים מה השרתון ענה וכמה בדיקות טופלו');
const m = D.normMet({ smp: [{ t: 1.8e9, cpu: 1, mem: 2, disk: 3, pq: 429, pqn: 7 }] });
ok(m && m.smp[0].pq === 429 && m.smp[0].pqn === 7, 'המדדים בשרתון שומרים pq ו־pqn');
console.log(`${n - fail}/${n}`);
process.exit(fail ? 1 : 0);
