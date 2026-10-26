// 26/10/2026: רצועת הכתוביות שבקובץ (בשפת המקור) כעזר להגהת התמלול — הטלפון בוחר, מחלץ, ממיר לפורמט שהעובד קורא
// (`[HH:MM:SS] טקסט`, pipeline.ref_lines) ומעלה לפני ההתחלה. התרגום עצמו — מהקול
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'studio.js'), 'utf8');
const grab = (name) => { const m = new RegExp('export function ' + name + '\\(([^)]*)\\) \\{([\\s\\S]*?)\\n\\}').exec(src); return m && new Function('SUBS_MAX', 'return function (' + m[1] + ') {' + m[2] + '\n}')(5 * 1024 * 1024); };
const hlpText = grab('hlpText'), auto = grab('trkHlpAuto');
ok(hlpText && auto, 'הפונקציות קיימות');
const txt = hlpText([{ s: 1.4, lines: ['Hello', 'there'] }, { s: 3723.9, lines: ['<i>Late</i>'] }, { s: 9, lines: [' '] }]);
ok(txt === '[00:00:01] Hello there\n[01:02:03] i Late /i\n', 'שורה לכל כתובית, זמן ההתחלה בשניות שלמות, בלי תגיות ובלי ריקות: ' + JSON.stringify(txt));
ok(hlpText([]) === '', 'בלי כתוביות — ריק');
const T = (id, o) => Object.assign({ id, kind: 'text', lang: 'en', forced: false, sdh: false }, o);
ok(auto([T(1, { forced: true }), T(2, { sdh: true }), T(3)]).id === 3, 'אוטומטי: באנגלית, לא כפויה ולא SDH קודם');
ok(auto([T(1, { forced: true }), T(2, { sdh: true })]).id === 2, 'אוטומטי: SDH עדיף על כפויה (חלקית)');
ok(auto([T(1, { lang: 'he' }), Object.assign(T(2), { kind: 'image' })]) === null, 'אוטומטי: רק רצועת טקסט באנגלית');
// הפורמט = מה שהעובד קורא
try {
  const out = execFileSync('python3', ['-I', '-c', 'import sys,json;sys.path.insert(0,sys.argv[1]);import pipeline as P;print(json.dumps(P.ref_lines(sys.stdin.read())))', path.join(__dirname, '..', 'translator')], { input: txt }).toString();
  const L = JSON.parse(out);
  ok(L.length === 2 && L[0][0] === 1 && L[1][0] === 3723 && L[0][1] === '[00:00:01] Hello there', 'העובד קורא בדיוק את מה שהטלפון כתב');
} catch (e) { console.log('# בלי python3 / ספריות — דילוג על בדיקת הפורמט מול העובד'); }
// הזרימה בקוד
ok(/trkHlpAuto\(L\.tracks\)/.test(src) && /!file\.remote \? trkHlpAuto/.test(src), 'בחירה אוטומטית רק כשהקובץ בטלפון (מ־Drive — החילוץ קורא את כל הקובץ ברשת)');
ok(/k\.src == null && k\.hlp != null/.test(src), 'עזר רק כשהתמלול מהקול (לא כשמתרגמים מהרצועה)');
ok(/spec\.eng === 'api'\) \{[^]*?trkWait\(f\)[^]*?hlpUpload\(rec, ht\)[^]*?form = null;/.test(src), 'מועלה לפני ההתחלה, רק כשהשרת שלנו מגיה');
ok(/which: 'r'/.test(src), 'נרשם כ־r');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
for (const k of ['studioTrkHlpT', 'studioTrkHlpNone', 'studioTrkHlpRow', 'studioTrkHlpNote']) ok((app.match(new RegExp('\\b' + k + ':', 'g')) || []).length === 2, 'מחרוזת בשתי השפות: ' + k);
console.log(`studio-subref: ${pass} עברו, ${fail} נכשלו`);
process.exit(fail ? 1 : 0);
