// 19/11/2026 (בקשת המשתמש): תור עבודות — פרויקט של הרבה סרטונים מעמוד "פעילה" (תרגום, ניתוח וקריוקי יחד).
// השרת מריץ עד QU_PAR מאותו תור במקביל, והשאר מחכות; עבודות רגילות (בלי qu) — בלי שום מגבלה חדשה
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const st = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));

// 1. אותו מספר בטלפון ובשרתון
ok(S.QU_PAR === 2 && /export const QU_PAR = 2;/.test(st), 'QU_PAR = 2 בשרתון ובטלפון');

// 2. normSpec — qu (= WL_RE) ושם נקי; מזהה לא תקין נזרק
const base = { name: 'a.mp4', size: 1000, dur: 60, from: 'auto', to: ['he'], eng: 'api', cap: 5 };
const s1 = S.normSpec(Object.assign({}, base, { qu: 'abc12345xyz', qn: '  סדרה‮ <b>1</b>\n' }));
ok(s1.qu === 'abc12345xyz' && s1.qn === 'סדרה <b>1</b>', 'normSpec: qu נשמר, השם בלי תווי בקרה וכיווניות');
ok(!('qu' in S.normSpec(Object.assign({}, base, { qu: '../x' }))) && !('qn' in S.normSpec(Object.assign({}, base, { qu: '../x', qn: 'x' }))), 'normSpec: מזהה לא תקין — בלי תור');
ok(!('qn' in S.normSpec(Object.assign({}, base, { qu: 'abc12345xyz', qn: '   ' }))), 'normSpec: שם ריק — לא נשמר');
ok(S.normSpec(Object.assign({}, base, { qu: 'abc12345xyz', qn: 'x'.repeat(200) })).qn.length === 60, 'normSpec: שם עד 60 תווים');

// 3. quBusy — רק מה שנלקח לשרת ועוד לא הסתיים
const now = Date.now();
const J = (id, state, extra) => Object.assign({ id, qu: 'q1', state, updated: now, created: now, spec: { eng: 'api' } }, extra);
const jobs = [J('a', 'running', { sid: 's1', claimed: now }), J('b', 'queued', { sid: 's1', pk: now }), J('c', 'queued', { sid: '' }), J('d', 'done', { sid: 's1' }),
  J('e', 'queued', { sid: '', vw: now }), J('f', 'running', { sid: 's1', qu: 'q2' })];
ok(S.quBusy(jobs, 'q1', now) === 2, 'quBusy: רצה + נלקחה (sid) = 2; בתור, חונה ושהסתיימה — לא');
ok(S.quBusy(jobs, 'q2', now) === 1 && S.quBusy([], 'q1', now) === 0 && S.quBusy(null, 'q1', now) === 0, 'quBusy: לפי התור בלבד; ריק — 0');

// 4. התרגום המקושר של ניתוח — באותו תור (תופס מקום)
const a = { id: 'an1', uid: 'u1', folder: 'R2_an1', spec: Object.assign({}, base, { vi: 1, vt: 1, qu: 'abc12345xyz', qn: 'פרויקט' }) };
const t = S.vtJob(a, null, 'tr1', now, 'en');
ok(t.qu === 'abc12345xyz' && t.spec.qu === 'abc12345xyz' && t.spec.qn === 'פרויקט', 'vtJob: התרגום המקושר יורש את התור');
ok(!('qu' in S.vtJob(Object.assign({}, a, { spec: Object.assign({}, a.spec, { qu: undefined }) }), null, 'tr2', now, 'en')), 'vtJob: בלי תור — בלי qu');

// 5. השרתון: create ולולאת הלקיחה
ok(/if \(spec\.qu && spec\.eng === 'api'\) job\.qu = spec\.qu;/.test(api), 'create: qu כשדה עליון (spec נשמר כ־JSON — לשאילתה)');
const loop = api.slice(api.indexOf('const quFull = async'), api.indexOf("const mk = S.memClass(job);"));
ok(/query\(deps, 'studioJobs', \{ qu: q \}, 100\)/.test(loop) && /if \(!quN\.has\(q\)\)/.test(loop), 'הספירה: שאילתה אחת לתור בפנייה, ורק כשעבודה מהתור מגיעה ללקיחה');
const iq = loop.indexOf('if (await quFull(job)) continue;'), ifit = loop.indexOf('if (fit && (S.peakNeed(job, fit)');
ok(iq > 0 && ifit > iq, 'התור המלא נבדק לפני הזיכרון — continue (לא break): לא חוסם עבודות רגילות ושל משתמשים אחרים');
ok(/if \(!q \|\| !S\.WL_RE\.test\(String\(q\)\)\) return false;/.test(loop), 'עבודה רגילה (בלי qu) — בלי שום מגבלה');

// 6. הטלפון — פונקציות טהורות מהקוד עצמו
const cut = (a1, b1) => st.slice(st.indexOf(a1), st.indexOf(b1));
const P = new Function("const FINAL = ['done', 'failed', 'cancelled'];\n" + cut('export function quMove', 'const quPhRank').replace(/export /g, '') + '\nreturn { quMove, quGroups };')();
ok(P.quMove(['a', 'b', 'c'], 2, -1).join() === 'a,c,b' && P.quMove(['a', 'b', 'c'], 0, 1).join() === 'b,a,c', 'quMove: למעלה ולמטה');
const m0 = ['a', 'b'];
ok(P.quMove(m0, 0, -1).join() === 'a,b' && P.quMove(m0, 1, 1).join() === 'a,b' && P.quMove(m0, 1, -1) !== m0 && m0.join() === 'a,b', 'quMove: בקצוות — בלי שינוי; לא משנה את המקור');
const R = (id, qu, state, created, qn) => ({ id, created, srv: { state }, spec: Object.assign({}, qu ? { qu } : {}, qn ? { qn } : {}) });
const gs = P.quGroups([R('1', 'qB', 'running', 30), R('2', 'qB', 'done', 20, 'ב'), R('3', 'qA', 'queued', 10, 'א'), R('4', null, 'running', 5), R('5', 'qC', 'done', 1)]);
ok(gs.map((g) => g.qu).join() === 'qA,qB' && gs[1].qn === 'ב' && gs[1].done === 1 && gs[1].all.length === 2 && gs[1].on.length === 1,
  'quGroups: רק תורים עם עבודה פתוחה, לפי הכניסה; השם, כמה הסתיימו ומה פתוח; עבודה רגילה — לא בתור');

// 7. הטלפון: החיבור
ok(/if \(WL_RE\.test\(String\(sp\.qu \|\| ''\)\)\) \{ spec\.qu = sp\.qu;/.test(st), 'normJob: qu נשמר אחרי סנכרון');
ok(/else if \(ui\.view === 'qnew'\) pageQu\(p\);/.test(st) && /x === 'qnew' \? \['act', null\]/.test(st), 'הדף והניווט ("חזור" — לעמוד הפעילות)');
ok(/inQ = new Set\(gs\.flatMap/.test(st) && /actSplit\(store\.jobs\.filter\(\(r\) => !inQ\.has\(r\.id\)\)/.test(st), 'עמוד הפעילות: עבודות התור בקבוצה משלהן, השאר כמו קודם');
ok(/for \(const \[id, fo\] of made\) \{ quPend\.delete\(id\); paintSoon\(\); try \{ await startRun\(id, fo\); \}/.test(st), 'ההעלאות — אחת אחרי השנייה');
// 7א. סבב 2 (19/11, בקשת המשתמש): עבודה אחרי עבודה דרך הטופס הרגיל, ורק בסוף "להתחיל את כל העבודות"
ok(/if \(f && f\.qd && !ui\.starting\) \{ quTake\(f\); return; \}/.test(st), 'הטופס הרגיל במצב תור: "להוסיף לתור" — לרשימה, לא יוצר עבודה');
ok(/const spec = formSpec\(f, file, pr, sm\);/.test(st) && /const spec = formSpec\(f, f\.fileObj, pr \|\| \{\}, sm\);/.test(st), 'אותו spec ב"להתחיל" וב"להוסיף לתור" (formSpec)');
ok(/const listOk = \(f\) => !!\(btOk\(f\) && f\.fileObj && !f\.qd\);/.test(st) && /end: f\.ka \|\| f\.vi \|\| f\.qd \? null : saveTop/.test(st), 'בתור: בלי "עוד סרטון" ובלי טיוטה');
ok(/const spec = Object\.assign\(\{\}, it\.spec, \{ qu: q\.qu \}, qn \? \{ qn \} : \{\}\);/.test(st), 'ההתחלה: כל עבודה עם ה־spec שלה, באותו תור');
ok(/r\.addEventListener\('contextmenu'/.test(cut('function pageQu', 'function quItemSub')) && /if \(o\.menu\) r\.addEventListener\('contextmenu'/.test(st), 'לחיצה ארוכה: ברשימה ובעמוד הפעילות');
ok(/net\.api\('qctl', \{ job: rec\.id, a, all: !!all \}\)/.test(st), 'השהיה / המשך / לראש התור — op: qctl');
// 7ג. השרתון: qctl, השהיה בלי קריאות ובלי תקרת זמן
{
  const t0 = 1e12;
  const Q = (x) => Object.assign({ id: 'x', qu: 'q1', state: 'queued', eng: 'api', sid: '', fired: t0, created: t0 - 10, spec: { eng: 'api' } }, x);
  ok(S.effState(Q({}), t0 + 10 * 3600e3).state === 'queued' && S.effState(Q({}), t0 + S.QU_WAIT + 1).state === 'failed', 'עבודה בתור מחכה לתורה — לא "אין שרת" אחרי 6 שעות (עד QU_WAIT)');
  ok(S.effState(Q({ qh: t0, sid: null }), t0 + 30 * 24 * 3600e3).state === 'queued', 'מושהית — בלי תקרת זמן');
  ok(S.effState(Q({ qz: 10 * 3600e3 }), t0 + S.QU_WAIT + 3600e3).state === 'queued', 'הזמן בהשהיה (qz) לא נספר');
  ok(S.effState(Object.assign(Q({}), { qu: undefined }), t0 + 7 * 3600e3).state === 'failed', 'עבודה רגילה — כמו קודם (6 שעות)');
  ok(S.quWaiting(Q({}), t0) && S.quWaiting(Q({ state: 'new' }), t0) && !S.quWaiting(Q({ sid: 's1' }), t0) && !S.quWaiting(Q({ state: 'running' }), t0) && !S.quWaiting(Q({ pk: t0 }), t0), 'quWaiting: רק מה שעוד לא נלקח');
  const hp = S.quPatch(Q({}), 'hold', t0 + 5);
  ok(hp.qh === t0 + 5 && hp.sid === null, 'השהיה: qh, ו־sid: null — מחוץ לשאילתת הלקיחה');
  const rp = S.quPatch(Q({ qh: t0, sid: null, qz: 100 }), 'run', t0 + 1000);
  ok(rp.qh === 0 && rp.sid === '' && rp.qz === 1100 && !('sid' in S.quPatch(Q({ qh: t0, state: 'new' }), 'run', t0 + 1)), 'המשך: sid חוזר (רק בתור לשרת), והזמן נצבר ב־qz');
  ok(S.quPatch(Q({ qh: t0 }), 'hold', t0) === null && S.quPatch(Q({}), 'run', t0) === null, 'השהיה/המשך כפולים — בלי כתיבה');
  ok(S.quTop([Q({ id: 'a', fired: t0 + 5 }), Q({ id: 'b', fired: t0 + 9 }), Q({ id: 'c', fired: t0 + 1, sid: 's1' })], t0 + 50) === t0 + 4, 'לראש התור: לפני כל מה שמחכה (לא מה שכבר נלקח)');
  ok(S.quKey({ qo: 5, fired: 9 }) === 5 && S.quKey({ fired: 9 }) === 9, 'quKey: qo קודם, אחרת fired');
  const pub = S.publicJob(Q({ qh: t0, qo: 77 }), t0);
  ok(pub.qh === 1 && pub.qo === 77 && S.publicJob(Object.assign(Q({ qh: t0 }), { qu: undefined }), t0).qh === 0, 'publicJob: qh ו־qo — רק בתור');
  const op = api.slice(api.indexOf("if (op === 'qctl') {"), api.indexOf("if (op === 'cancel') {"));
  ok(/\['hold', 'run', 'top'\]\.includes\(a\)/.test(op) && /S\.quWaiting\(j, now\)/.test(op) && /limited\('qc\|' \+ uid, 60\)/.test(op), 'qctl: פעולות מוגדרות, רק מה שמחכה, מגביל קצב');
  ok(/sid: job\.qu && job\.qh \? null : ''/.test(api), 'queueApi: מושהית בזמן ההעלאה — נשארת מושהית כשהיא נכנסת לתור');
  ok(/if \(job\.qu && job\.qh\) continue;/.test(loop) && /S\.quKey\(a\) - S\.quKey\(b\)/.test(api), 'הלקיחה: מדלגת על מושהית, ולפי quKey');
}
ok(/go1\.disabled = !n \|\| n > QU_MAX/.test(st) && /export const QU_MAX = 40;/.test(st) && S.maxActive() >= 40, 'עד QU_MAX בפעם אחת (בתוך מגבלת העבודות הפעילות של השרתון)');
// 7ב. מנהל העבודות (19/11, בקשת המשתמש): בלי "אחרונה" — מה שהסתיים ועוד לא נפתח
{
  const U = new Function("const FINAL = ['done', 'failed', 'cancelled'];\n" + cut('export const ACT_RECENT_MS', '/* דף בניית התור').replace(/export /g, '') + '\nreturn { actUnseen, ACT_RECENT_MS };')();
  const T0 = 1e12, D = 24 * 3600e3;
  const Rx = (id, state, ended, sn) => ({ id, created: ended - 1000, srv: { state, ended }, spec: {}, ...(sn ? { sn } : {}) });
  const l = U.actUnseen([Rx('a', 'done', T0 + 5 * D), Rx('b', 'failed', T0 + 6 * D), Rx('c', 'done', T0 + 4 * D, T0 + 5 * D), Rx('d', 'cancelled', T0 + 6 * D),
    Rx('e', 'done', T0 - 1), Rx('f', 'running', 0), Rx('g', 'done', T0 + 0.5 * D)], T0, T0 + 8 * D);
  ok(l.map((r) => r.id).join() === 'b,a', 'actUnseen: הסתיימו/נכשלו ולא נפתחו, החדשות קודם; לא: נפתחה, בוטלה, לפני שהמכשיר התחיל לסמן, רצה, ישנה משבוע');
  ok(/if \(!rec\.sn && rec\.srv && FINAL\.includes\(rec\.srv\.state\)\) \{ rec\.sn = Date\.now\(\); saveSoon\(\); \}/.test(st), 'דף העבודה: נפתחה אחרי שהסתיימה — sn');
  ok(/\.\.\.\(num\(j\.sn\) \? \{ sn: num\(j\.sn\) \} : \{\}\)/.test(st) && /return \{ sna: num\(src\.sna\) \|\| Date\.now\(\),/.test(st), 'sn ו־sna נשמרים (normJob / normStore)');
  ok(/job: '<path d="M3 6h10M3 12h5\.5M3 18h7"\/><circle cx="16\.5" cy="15" r="5"\/>/.test(st) && !/M3 12h3\.8l2\.4-6\.5/.test(st), 'הסמל: רשימה ושעון (חלופה ו׳), לא הפעימה');
  ok(/dialLabel\(jb, T\('studioDialOn'\)\)/.test(st) && /lbl: T\('studioDialOn'\)/.test(st), 'החוגה: תמיד "מנהל עבודות"');
}
// 8. studio.js נטען כמודול (19/11: הערה בסוף שורה בלעה "}" — הבדיקות ב־vm עברו והדף לא נטען)
{
  const os = require('os'), cp = require('child_process');
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stq-')), 'studio.mjs');
  fs.writeFileSync(tmp, st);
  ok(cp.spawnSync(process.execPath, ['--check', tmp]).status === 0, 'studio.js — תחביר תקין כמודול (node --check על .mjs)');
}
ok(/const quOk = \(\) => !!\(ui\.api && ui\.api\.servers > 0 && ui\.r2\);/.test(st), '2.192.1: הכרטיס — כשיש שרת ו־R2, בלי תלות במנוע שבהגדרות');
ok(/else if \(ryMode\(\)\) Object\.assign\(spec, \{ eng: 'api', cap: store\.settings\.cap, ry: 1 \}\);/.test(cut('function formSpec', 'function startFromForm')) && /if \(spec\.eng !== 'api'\) Object\.assign\(spec, \{ eng: 'api'/.test(st) && /delete spec\.cp;/.test(st) && /if \(it\.k === 'tr' && !sp\.ry\) t \+= startEstimate\(/.test(st), '2.192.1: "המנוי שלי" — התרגום דרכו (formSpec), ובלי עלות באומדן; תמיד בשרת, בלי העתק־הדבק');
console.log('# ' + n + ' בדיקות');
