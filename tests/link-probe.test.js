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
// 24/10/2026 (כמו ב־Studio DM — ההורדה עצמה היא הבדיקה): הבדיקה בשרת לא חזרה → "להוריד בענן בלי בדיקה"
const fn = (name) => { const i = st.indexOf('export function ' + name + '('); const j = st.indexOf('\n}\n', i); return st.slice(i + 7, j + 2); };
const urlTitle = new Function(fn('urlTitle') + '; return urlTitle;')();
ok(urlTitle('https://www.ted.com/talks/sir_ken_robinson_do_schools_kill_creativity') === 'sir ken robinson do schools kill creativity', 'השם מהכתובת — הקטע האחרון, קווים לרווחים');
ok(urlTitle('https://x.com/a/%D7%A9%D7%9C%D7%95%D7%9D.mp4') === 'שלום' && urlTitle('https://vimeo.com/') === 'vimeo.com' && urlTitle('לא כתובת') === 'video', 'פענוח, סיומת, בלי נתיב — שם האתר, כתובת שבורה — "video"');
ok(/const BLIND_ERRS = \['timeout', 'no_take', 'net'\]/.test(st) && /youtube\\\.com\|youtu\\\.be/.test(st) && /!ui\.url \|\| devDl\(\)/.test(st), 'רק כשהשרת לא ענה, רק בדפדפן עם ענן מותר, לא ביוטיוב');
ok(/L\.blind \? \{ h: 0 \} : linkPick\(L\)/.test(st) && /size: L\.blind \? 1 :/.test(st), 'בלי בדיקה — העובד בוחר את האיכות (h:0) והגודל נקבע בהורדה');
ok((st.match(/blindUndo\(L\);/g) || []).length === 2 && /f\.link !== L \|\| L\.blind\) return;/.test(st), 'ביטול האומדן / כשל ביצירה מחזיר לשגיאה, ובדיקה מאוחרת לא דורסת');
ok((app.match(/studioLinkBlind: "/g) || []).length === 2 && (app.match(/studioLinkBlindS: "/g) || []).length === 2, 'הכפתור וההסבר בעברית ובאנגלית');
const SU = require('../ibkr-proxy/lib/studiourl.js');
ok(JSON.stringify(SU.normPick({ h: 0 })) === '{"h":0}', 'השרתון מקבל בחירה ריקה');
console.log(`${n - fail}/${n}`);
process.exit(fail ? 1 : 0);
