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
const P = new Function("const FINAL = ['done', 'failed', 'cancelled'];\n" + cut('export function quKinds', 'const quPhRank').replace(/export /g, '') + '\nreturn { quKinds, quGroups };')();
ok(P.quKinds({ tr: true, vi: true, ka: true }, true).join() === 'vt,ka', 'quKinds: ניתוח + תרגום = ניתוח עם "גם תרגום" (העלאה אחת); וקריוקי');
ok(P.quKinds({ tr: true, vi: true }, false).join() === 'vi,tr', 'quKinds: בלי "גם תרגום" — שתי עבודות');
ok(P.quKinds({ tr: true }, true).join() === 'tr' && P.quKinds({ ka: true }, true).join() === 'ka' && !P.quKinds({}, true).length, 'quKinds: כל כלי לבד; כלום — כלום');
const R = (id, qu, state, created, qn) => ({ id, created, srv: { state }, spec: Object.assign({}, qu ? { qu } : {}, qn ? { qn } : {}) });
const gs = P.quGroups([R('1', 'qB', 'running', 30), R('2', 'qB', 'done', 20, 'ב'), R('3', 'qA', 'queued', 10, 'א'), R('4', null, 'running', 5), R('5', 'qC', 'done', 1)]);
ok(gs.map((g) => g.qu).join() === 'qA,qB' && gs[1].qn === 'ב' && gs[1].done === 1 && gs[1].all.length === 2 && gs[1].on.length === 1,
  'quGroups: רק תורים עם עבודה פתוחה, לפי הכניסה; השם, כמה הסתיימו ומה פתוח; עבודה רגילה — לא בתור');

// 7. הטלפון: החיבור
ok(/if \(WL_RE\.test\(String\(sp\.qu \|\| ''\)\)\) \{ spec\.qu = sp\.qu;/.test(st), 'normJob: qu נשמר אחרי סנכרון');
ok(/else if \(ui\.view === 'qnew'\) pageQu\(p\);/.test(st) && /x === 'qnew' \? \['act', null\]/.test(st), 'הדף והניווט ("חזור" — לעמוד הפעילות)');
ok(/inQ = new Set\(gs\.flatMap/.test(st) && /actSplit\(store\.jobs\.filter\(\(r\) => !inQ\.has\(r\.id\)\)/.test(st), 'עמוד הפעילות: עבודות התור בקבוצה משלהן, השאר כמו קודם');
ok(/for \(const \[id, fo\] of made\) \{ quPend\.delete\(id\); paintSoon\(\); try \{ await startRun\(id, fo\); \}/.test(st), 'ההעלאות — אחת אחרי השנייה');
ok(/qu: q\.qu \};/.test(st) && /if \(k === 'ka'\) \{ ff\.ka = true; kaSpec\(ff, spec\); \}/.test(st) && /viSpecOf\(Object\.assign\(ff, \{ vi: true, vf: 'auto', vt: k === 'vt' \}\), spec\)/.test(st), 'quSpec: אותן פונקציות של הטפסים, עם התור');
ok(/go1\.disabled = !n \|\| n > QU_MAX/.test(st) && /export const QU_MAX = 40;/.test(st) && S.maxActive() >= 40, 'עד QU_MAX בפעם אחת (בתוך מגבלת העבודות הפעילות של השרתון)');
// 8. studio.js נטען כמודול (19/11: הערה בסוף שורה בלעה "}" — הבדיקות ב־vm עברו והדף לא נטען)
{
  const os = require('os'), cp = require('child_process');
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stq-')), 'studio.mjs');
  fs.writeFileSync(tmp, st);
  ok(cp.spawnSync(process.execPath, ['--check', tmp]).status === 0, 'studio.js — תחביר תקין כמודול (node --check על .mjs)');
}
console.log('# ' + n + ' בדיקות');
