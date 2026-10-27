// 27/10/2026 — מאגר הלמידה, סבב 2: מה השרתון מקבל מהשדות החדשים ומה הוא מחשב מהם.
// זמן מעבד לכל פקודת vt (lx.vt[4] → vtTime.cr), סוג התוכן (lx.ct → ctView), מדידות "הכל בטלפון" (lx.ph).
// הרצה: node tests/learn-extra2.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const SL = require(path.join(root, 'ibkr-proxy/lib/studiolearn.js'));

/* ---------- זמן מעבד ---------- */
const v = SL.normLx({ vt: [['align', 2, 180, 120, 178.7], ['ingest', 1, 10, 10], ['render', 1, 50, 50, -3], ['plan', 1, 1, 1, 'x']] });
ok(JSON.stringify(v.vt[0]) === JSON.stringify(['align', 2, 180, 120, 178.7]), 'vt עם זמן מעבד');
ok(v.vt[1].length === 4 && v.vt[2].length === 4 && v.vt[3].length === 4, 'בלי זמן מעבד / ערך לא תקין — בלי העמודה, השורה נשארת');

/* ---------- סוג התוכן ---------- */
const c = SL.normLx({ ct: { k: 1, spk: 2, dom: 0.6, swm: 3.5, shm: 2, ot: 0.1, sp: 0.85, evil: 3 } }).ct;
ok(c.k === 1 && c.dom === 0.6 && !('evil' in c), 'ct — רק המפתחות המוכרים');
ok(!('k' in SL.normLx({ ct: { k: 99, spk: 1 } }).ct), 'ct.k מחוץ לטווח — בחוץ');
ok(!('ct' in SL.normLx({ ct: [1] })), 'ct שאינו אובייקט — בחוץ');
const py = fs.readFileSync(path.join(root, 'translator/job.py'), 'utf8');
ok(py.includes("CT_KINDS = ('" + SL.CT_KINDS.join("', '") + "')"), 'CT_KINDS זהה ב־job.py');

/* ---------- "הכל בטלפון" ---------- */
const p = SL.normLx({ ph: { 'asr.t': 312.4, 'asr.b0': 80, 'asr.c1': 39.8, 'dev.cores': 8, 'hack.t': 1, 'asr.zz': 2, 'dev.model': 3 } }).ph;
ok(p['asr.t'] === 312.4 && p['dev.cores'] === 8 && !('hack.t' in p) && !('asr.zz' in p) && !('dev.model' in p), 'ph — רק שלבים ומפתחות מוכרים');
const kt = fs.readFileSync(path.join(root, 'android/app/src/studio/java/io/github/yishaiguedj1/snowball/PhTel.kt'), 'utf8');
for (const k of ['t', 'n', 'b0', 'b1', 'c0', 'c1', 'ch', 'th', 'cores', 'mem', 'sdk']) ok(kt.includes('"' + k + '"'), 'PhTel כותב ' + k);
ok(!/Build\.MODEL|ANDROID_ID|getSerial|IMEI/i.test(kt), 'PhTel — בלי דגם ובלי מזהה מכשיר');

/* ---------- המבט במרכז הניהול ---------- */
const now = Date.now();
const rec = (id, k, q, extra) => Object.assign({ v: SL.LR_V, use: [], t: {}, id: id + '0000000', k: 'tr', st: 'done', at: now - 3600e3, dur: 600, usd: 0.5, pr: 1, fires: 1, q: { s: q }, lx: { ct: { k }, vt: [['align', 1, 100, 100, 90]] } }, extra || {});
const view = SL.learnView([rec('a', 0, 90), rec('b', 0, 80), rec('c', 3, 60), rec('d', 0, 70, { lx: { ct: { k: 0 }, vt: [['align', 1, 100, 100]] } })], now);
ok(view.ct[0].k === 'talk' && view.ct[0].n === 3 && view.ct[0].q === 80 && view.ct[0].ok === 1, 'ctView — לפי סוג, חציון האיכות');
ok(view.ct[1].k === 'show' && view.ct[1].n === 1, 'ctView — הסוג השני');
const al = view.vt.find((x) => x.c === 'align');
ok(al.cr === 0.9 && al.sec === 400, 'vtTime.cr — רק מהפקודות שנמדד להן מעבד');

/* ---------- התצוגה ---------- */
const adm = fs.readFileSync(path.join(root, 'admin-app.js'), 'utf8');
for (const k of SL.CT_KINDS) ok(adm.includes("case '" + k + "': return t('admCt_" + k + "')"), 'שם לסוג ' + k);
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
for (const k of ['admVtCpu', 'admCtG', 'admCtN', 'admCtJd', 'admCtOk', 'admCtSpm'].concat(SL.CT_KINDS.map((x) => 'admCt_' + x))) ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, k + ' בשתי השפות');

console.log(`\n${n} בדיקות עברו`);
