// 21/10/2026 (בקשת המשתמש): תמונה ממוזערת לכל עבודה + תמונה בנגן לפני הניגון (כמו YouTube), ובפתיחה על נקודה — הפריים
// שלה; בבית רק 5 העבודות האחרונות בכרטיס שנגלל בתוכו; עבודה ב־R2 נמחקת חודש אחרי הסיום (מאגר הלמידה נשאר)
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
ok((st.match(/poster: (rec \? )?thumbFor\(rec/g) || []).length >= 4 && /poster: at >= 0 \? '' : thumbFor\(rec/.test(st), 'כל הנגנים עם תמונה לפני הניגון; העורך שנפתח על נקודה — בלי תמונה');
ok(/me\.at = Math\.max\(0, me\.ed\.cues\(\)\[k\]\.s - 0\.05\)/.test(st) && /if \(at >= 0\) \{/.test(st) && /firstShown\(\)/.test(fs.readFileSync(path.join(root, 'studiosubs.js'), 'utf8')), 'עורך שנפתח על "רק לבדיקה" — הנגן קופץ לכתובית הראשונה (הפריים שלה)');
const sp = new Function('v', pl.slice(pl.indexOf('const setPoster'), pl.indexOf('setPoster(opts.poster);')) + '\nreturn setPoster;');
const v = { poster: '' }, setP = sp(v);
setP('https://evil.example/x.jpg'); setP('javascript:alert(1)');
ok(v.poster === '', 'setPoster — רק data:/blob: (לא כתובת חיצונית)');
setP('data:image/jpeg;base64,AAAA');
ok(v.poster === 'data:image/jpeg;base64,AAAA', 'setPoster — תמונה מקומית מתקבלת');

ok(/export const JOBS_SHOWN = 5;/.test(st) && /function jobsCard\(rows\)/.test(st) && /jobsCard\(rows\)\)/.test(st), 'בבית — 5 העבודות האחרונות, בכרטיס משלהן');
ok(/\.st-list\.st-jobs \{ overflow-y: auto; overscroll-behavior: contain;/.test(css), 'הכרטיס נגלל בתוכו, והגלילה לא עוברת לעמוד');
ok(/l\.scrollBy\(\{ top: Math\.max\(60, l\.clientHeight - 24\), behavior: 'smooth' \}\)/.test(st) && /more\.hidden = !left/.test(st), '"עבודות קודמות" גולל בתוך הכרטיס, ונעלם כשאין עוד');

const D = 86400e3, now = Date.UTC(2026, 9, 21), F = 'R2_j' + 'a'.repeat(20);
ok(SC.expiredJob({ kind: 'tr', state: 'done', folder: F, ended: now - 31 * D }, now), 'אחרי חודש — עבודה ב־R2 נמחקת');
ok(!SC.expiredJob({ kind: 'tr', state: 'done', folder: F, ended: now - 29 * D }, now), 'לפני חודש — נשארת');
ok(!SC.expiredJob({ kind: 'tr', state: 'running', folder: F, ended: now - 40 * D }, now), 'עבודה שעוד רצה — לא נמחקת');
ok(!SC.expiredJob({ kind: 'tr', state: 'done', folder: F, ended: now - 40 * D, gd: { ref: 'x' } }, now), 'עבודת זהב — לא נמחקת');
ok(!SC.expiredJob({ kind: 'tr', state: 'done', folder: 'DriveFolder01234567', ended: now - 40 * D }, now), 'עבודה ב־Drive של המשתמש — לא נמחקת');
const gc = api.slice(api.indexOf('async function jobGc'), api.indexOf('\n}\n', api.indexOf('async function jobGc')));
ok(/removeJobRec\(deps, j\.uid, j, now\)/.test(gc) && !/learn|snb-learn|R2L/i.test(gc.replace(/removeJobRec/g, '')), 'המחיקה דרך removeJobRec (שומר קודם במאגר הלמידה) — בלי לגעת במאגר עצמו');
ok(/await learnSave\(deps, job, now\);\s+\/\/[^\n]*\n\s+await delDoc\(deps, 'studioJobs', job\.id\)/.test(api), 'removeJobRec — מאגר הלמידה נשמר לפני מחיקת הרשומה');
console.log(n + ' בדיקות עברו');
