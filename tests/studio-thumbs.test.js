// 21/10/2026 (בקשת המשתמש): תמונה ממוזערת לכל עבודה + תמונה בנגן לפני הניגון (לפי ת־נגן), ובפתיחה על נקודה — הפריים
// שלה; בבית הכרטיס של העבודות בגובה המסך (נגלל בתוכו, "עבודות קודמות" תמיד גלוי); עבודה ב־R2 נמחקת חודש אחרי הסיום (מאגר הלמידה נשאר)
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const st = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
const pl = fs.readFileSync(path.join(root, 'studioplay.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'studio.css'), 'utf8');
const api = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
const SC = require(path.join(root, 'ibkr-proxy/lib/studioscan.js'));

// הפונקציות הטהורות — מהקוד עצמו
const pure = st.slice(st.indexOf('export const THUMB_W'), st.indexOf('const thumbs = new Map()')).replace(/export /g, '');
const P = new Function(pure + '\nreturn { thumbTimes, thumbOk, THUMB_AT };')();
ok(JSON.stringify(P.thumbTimes(100)) === '[20,8,40,60]', 'הנקודות לפריים — חלקים מהאורך (20% קודם, פתיח שחור לא נבחר)');
ok(JSON.stringify(P.thumbTimes(0)) === '[1,0]' && JSON.stringify(P.thumbTimes(NaN)) === '[1,0]', 'אורך לא ידוע — שתי נקודות קבועות');
ok(P.thumbTimes(0.5).every((t) => t >= 0 && t <= 0.4), 'סרטון קצר מאוד — בתוך האורך');
ok(!P.thumbOk(8, 3) && !P.thumbOk(250, 5) && !P.thumbOk(120, 4) && P.thumbOk(120, 40), 'פריים שחור / לבן / אחיד — לא נבחר');

ok(/indexedDB\.open\('snb-studio', 3\)/.test(st) && /'thumbs'/.test(st), 'התמונות ב־IndexedDB (מאגר thumbs, גרסה 3) — לא ב־localStorage');
ok(/idbOp\('thumbs', 'del', id\); thumbs\.delete\(id\)/.test(st) && /idbOp\('thumbs', 'del', x\.id\)/.test(st), 'עבודה שנמחקה (בטלפון או בשרתון) — גם התמונה שלה נמחקת');
ok(/if \(f\.fileObj\) thumbFor\(rec, null, f\.fileObj\)/.test(st), 'עבודה חדשה — התמונה מהקובץ שבטלפון, בלי לחכות להעלאה');
ok(/paintThumb\(th, rec\)/.test(st) && /\.st-thumb\.img \{ background-size: cover/.test(css) && /\.st-thumb\.img > svg \{ display: none; \}/.test(css), 'רשימת העבודות — התמונה במקום סמל הסרט');
// 29/10/2026 (פרויקט "עמודים סטטיים"): <img> מפוענח ששמור לפי עבודה — לא background-image שמפוענח מחדש בכל ציור (אריח ריק בטלפון)
ok(/function thumbEl\(id, u\)[\s\S]{0,400}im\.decoding = 'sync'[\s\S]{0,200}im\.decode\(\)/.test(st) && /th\.prepend\(thumbEl\(rec\.id, u\)\)/.test(st) && !/th\.style\.backgroundImage/.test(st.slice(st.indexOf('function paintThumb'), st.indexOf('function paintThumb') + 500)) && /\.st-thumb > \.st-tim \{ position: absolute; inset: 0;[^}]*object-fit: cover/.test(css), 'התמונה הממוזערת — אותו <img> מפוענח בכל ציור');
ok(/dec\.push\(thumbEl\(c\.key, c\.value\)\.decode\(\)/.test(st) && /Promise\.all\(dec\)\.then\(\(\) => ok\(\)\)/.test(st), 'התמונות מפוענחות כבר בטעינה — הציור הראשון של הבית מלא');
ok((st.match(/poster: (rec \? )?thumbFor\(rec/g) || []).length >= 4 && /poster: at >= 0 \? '' : thumbFor\(rec/.test(st), 'כל הנגנים עם תמונה לפני הניגון; העורך שנפתח על נקודה — בלי תמונה');
ok(/me\.at = Math\.max\(0, me\.ed\.cues\(\)\[k\]\.s - 0\.05\)/.test(st) && /if \(at >= 0\) \{/.test(st) && /firstShown\(\)/.test(fs.readFileSync(path.join(root, 'studiosubs.js'), 'utf8')), 'עורך שנפתח על "רק לבדיקה" — הנגן קופץ לכתובית הראשונה (הפריים שלה)');
const sp = new Function('v', pl.slice(pl.indexOf('const setPoster'), pl.indexOf('setPoster(opts.poster);')) + '\nreturn setPoster;');
const v = { poster: '' }, setP = sp(v);
setP('https://evil.example/x.jpg'); setP('javascript:alert(1)');
ok(v.poster === '', 'setPoster — רק data:/blob: (לא כתובת חיצונית)');
setP('data:image/jpeg;base64,AAAA');
ok(v.poster === 'data:image/jpeg;base64,AAAA', 'setPoster — תמונה מקומית מתקבלת');

const fitSrc = st.slice(st.indexOf('export const JOBS_MIN'), st.indexOf('function jobsCard(rows)')).replace(/export /g, '');
const jobsFit = new Function(fitSrc + '\nreturn jobsFit;')();
ok(jobsFit([106, 106, 106, 106, 106, 106, 106], 430) === 4 && jobsFit([106, 106, 106, 106, 106, 106, 106], 540) === 5 && jobsFit(Array(12).fill(100), 640) === 6,
  'כמה עבודות בכרטיס — לפי הגובה הפנוי במסך (4 בטלפון רגיל, 5–6 במסך גדול)');
ok(jobsFit(Array(9).fill(106), 150) === 2 && jobsFit(Array(20).fill(50), 5000) === 8, 'מסך קטן מאוד — לפחות 2; מסך ענק — עד 8');
ok(/function jobsCard\(rows\)/.test(st) && /jobsCard\(rows\)\)/.test(st) && /const avail = \(sc\.clientHeight \|\| innerHeight\) - top - mb - Math\.max\(16, pb\);/.test(st),
  'הגובה הפנוי = המסך פחות מה שמעל הכרטיס, הכפתור והריפוד בתחתית — העמוד סטטי והכפתור תמיד גלוי');
ok(/new ResizeObserver\(/.test(st.slice(st.indexOf('function jobsCard'))) && /addEventListener\('resize', onRs\)/.test(st) && /document\.fonts\.ready\.then/.test(st),
  'חישוב מחדש כשגובה השורות משתנה (גופן, שם בשתי שורות) וכשהמסך משתנה');
ok(/l\.scrollTo\(\{ top: Math\.min\(to, max\), behavior: 'smooth' \}\)/.test(st) && /T\('studioJobsTop'\)/.test(st) && /l\.scrollTo\(\{ top: 0, behavior: 'smooth' \}\)/.test(st),
  '"עבודות קודמות" — השורה האחרונה שנראית עולה לראש הכרטיס; בסוף הרשימה הכפתור נשאר: "חזרה לעבודות האחרונות"');
ok(/scroll-snap-type: y proximity/.test(css) && /\.st-list\.st-jobs > \.st-proj \{ scroll-snap-align: start; \}/.test(css) && /touch-action: pan-y/.test(css), 'גלילה באצבע בתוך הכרטיס — נעצרת על תחילת שורה');

const D = 86400e3, now = Date.UTC(2026, 9, 21), F = 'R2_j' + 'a'.repeat(20);
ok(SC.expiredJob({ kind: 'tr', state: 'done', folder: F, ended: now - 31 * D }, now), 'אחרי חודש — עבודה ב־R2 נמחקת');
ok(!SC.expiredJob({ kind: 'tr', state: 'done', folder: F, ended: now - 29 * D }, now), 'לפני חודש — נשארת');
ok(!SC.expiredJob({ kind: 'tr', state: 'running', folder: F, ended: now - 40 * D }, now), 'עבודה שעוד רצה — לא נמחקת');
ok(!SC.expiredJob({ kind: 'tr', state: 'done', folder: F, ended: now - 40 * D, gd: { ref: 'x' } }, now), 'עבודת זהב — לא נמחקת');
ok(!SC.expiredJob({ kind: 'tr', state: 'done', folder: 'DriveFolder01234567', ended: now - 40 * D }, now), 'עבודה ב־Drive של המשתמש — לא נמחקת');
const gc = api.slice(api.indexOf('async function jobGc'), api.indexOf('\n}\n', api.indexOf('async function jobGc')));
ok(/removeJobRec\(deps, j\.uid, j, now\)/.test(gc) && !/learn|snb-learn|R2L/i.test(gc.replace(/removeJobRec/g, '')), 'המחיקה דרך removeJobRec (שומר קודם במאגר הלמידה) — בלי לגעת במאגר עצמו');
ok(/await learnSave\(deps, job, now\);\s+\/\/[^\n]*\n\s+await delDoc\(deps, 'studioJobs', job\.id\)/.test(api), 'removeJobRec — מאגר הלמידה נשמר לפני מחיקת הרשומה');
const app = fs.readFileSync(path.join(root, 'studio-app.js'), 'utf8');
const srcFn = st.slice(st.indexOf('function thumbSources(rec)'), st.indexOf('function thumbsLoad()'));
ok(srcFn.indexOf('hl[hl.length - 1].id') < srcFn.indexOf("['small', 'compact', 'same']") && srcFn.indexOf("['small', 'compact', 'same']") < srcFn.indexOf('rec.up.v && rec.up.v.id'),
  'מקור לפריים — מהקטן לגדול: איכות הצפייה הנמוכה, העותק הצרוב, ואז המקור (סרטון כבד/לא מפוענח לא משאיר עבודה בלי תמונה)');
ok(/for \(const x of srcs\) \{ tried = true; u = await grabFrame\(x\.u, x\.wait\); if \(u\) break; \}/.test(st), 'מקור שנכשל — עוברים לבא');
ok(/x\.spec\.name === sp\.name && x\.spec\.size === sp\.size/.test(st) && /u = thumbs\.get\(x\.id\) \|\| ''/.test(st) && /for \(const y of thumbSources\(x\)\)/.test(st),
  'עבודה בלי סרטון בענן (בוטלה לפני ההעלאה) — התמונה של עבודה אחרת מאותו קובץ, או פריים מהסרטון שלה');
ok(/export const thumbsReady = thumbChain = thumbsLoad\(\);/.test(st) && /Promise\.race\(\[thumbsReady, new Promise\(\(r\) => setTimeout\(r, 400\)\)\]\)\.then\(\(\) =>\s*openStudio\(/.test(app),
  'התמונות השמורות נטענות לפני הציור הראשון (מאחורי הווילון, עד 400ms) — בלי הבהוב בכל פתיחה');
ok(/if \(Date\.now\(\) - t0 > 250\) th\.classList\.add\('in'\)/.test(st), 'דהייה רק לתמונה חדשה שמגיעה אחרי שהמסך מוצג');
console.log(n + ' בדיקות עברו');
