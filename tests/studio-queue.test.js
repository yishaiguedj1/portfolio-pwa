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
ok(S.QU_PAR === 3 && /export const QU_PAR = 3;/.test(st), 'QU_PAR = 3 בשרתון ובטלפון');

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
const iq = loop.indexOf('if (!S.btBack(job, br, lost) && await quFull(job)) continue;'), ifit = loop.indexOf('if (fit && (S.peakNeed(job, fit)');
ok(iq > 0 && ifit > iq, 'התור המלא נבדק לפני הזיכרון — continue (לא break): לא חוסם עבודות רגילות ושל משתמשים אחרים');
ok(/if \(!q \|\| !S\.WL_RE\.test\(String\(q\)\)\) return false;/.test(loop), 'עבודה רגילה (בלי qu) — בלי שום מגבלה');

// 6. הטלפון — פונקציות טהורות מהקוד עצמו
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const cut = (a1, b1) => st.slice(st.indexOf(a1), st.indexOf(b1));
const P = new Function("const FINAL = ['done', 'failed', 'cancelled'];\n" + cut('export function quGroups', 'const quPhRank').replace(/export /g, '') + '\nreturn { quGroups };')();
const R = (id, qu, state, created, qn) => ({ id, created, srv: { state }, spec: Object.assign({}, qu ? { qu } : {}, qn ? { qn } : {}) });
const gs = P.quGroups([R('1', 'qB', 'running', 30), R('2', 'qB', 'done', 20, 'ב'), R('3', 'qA', 'queued', 10, 'א'), R('4', null, 'running', 5), R('5', 'qC', 'done', 1)]);
ok(gs.map((g) => g.qu).join() === 'qA,qB' && gs[1].qn === 'ב' && gs[1].done === 1 && gs[1].all.length === 2 && gs[1].on.length === 1,
  'quGroups: רק תורים עם עבודה פתוחה, לפי הכניסה; השם, כמה הסתיימו ומה פתוח; עבודה רגילה — לא בתור');

// 7. הטלפון: החיבור
ok(/if \(WL_RE\.test\(String\(sp\.qu \|\| ''\)\)\) \{ spec\.qu = sp\.qu;/.test(st), 'normJob: qu נשמר אחרי סנכרון');
ok(/else if \(ui\.view === 'qnew'\) pageQu\(p\);/.test(st) && /x === 'qnew' \? \['act', null\]/.test(st), 'הדף והניווט ("חזור" — לעמוד הפעילות)');
ok(/inQ = new Set\(gs\.flatMap/.test(st) && /actSplit\(store\.jobs\.filter\(\(r\) => !inQ\.has\(r\.id\)\)/.test(st), 'עמוד הפעילות: עבודות התור בקבוצה משלהן, השאר כמו קודם');
ok(/quChain\.then\(\(\) => \{ if \(!quPend\.delete\(id\)\) return null;/.test(st) && /const up = \(\) => quUp\(f, rec\.id, \(\) => startRun\(rec\.id, ext \? null : file\)\);/.test(st), 'ההעלאות מהתור — אחת אחרי השנייה; בוטלה בזמן ההמתנה — בלי העלאה');
// 7א. 20/11 (בקשת המשתמש): "להוסיף לתור" = אותה התחלה כמו פרויקט רגיל, מכל מקור — עם סימון התור, ובסוף לעמוד התור
// 7ד. 20/11 (בקשת המשתמש, הקלטת מסך): "להוסיף לתור" לא מתחיל — רשימה עם אומדן; "להתחיל" = חלון עם הכל, ואז כולן יחד
ok(!/quTake|quStart/.test(st), 'בלי המנגנון הישן של סבב 1');
ok((st.match(/if \(quHold\(f, spec\)\) return;/g) || []).length === 4, 'quHold לפני היצירה בשרת: סרטון/Drive, קובץ כתוביות, קישור לענן, דרך האפליקציה');
ok(/if \(f\.ph && !quPhOk\(f\)\) return false;/.test(st) && /f\.ph\.nu && \(f\.ph\.cap \|\| 0\) >= PH_CAP_Q/.test(st), 'דרך האפליקציה — רק Studio שיודע phq (ישן — מיד, כמו קודם)');
// 7ה. סבב 2 (20/11): הרשימה נשמרת עם הקבצים — בלי לבחור שוב; דרך האפליקציה — פתיחה אחת לכולן
ok(/IDB_STORES = \['handles', 'drafts', 'thumbs', 'qdr', 'lib'\]/.test(st) && /quDrLoad\(\)\.catch/.test(st) && /idbOp\('qdr', 'put', it\.id/.test(st), 'הרשימה ב־IndexedDB (qdr), נטענת בפתיחה');
ok(app.includes("'pwa_studio_qdr_v1'") && /export const QDR_LS = 'pwa_studio_qdr_v1';/.test(st) && /for \(const k of keys\) if \(!ids\.includes\(k\)\) idbOp\('qdr', 'del', k\);/.test(st), 'המזהים במפתח של החשבון (ACCOUNT_KEYS); מה שלא שלו — נמחק');
{ const ga = cut('async function quGoAll', '/* הקבוצות לעמוד');
  ok(ga.indexOf('if (pr && pr.done) phQOpen(pr);') > 0 && ga.indexOf('if (pr && pr.done) phQOpen(pr);') < ga.indexOf('await'), 'האפליקציה נפתחת עוד בתוך הנגיעה — לפני כל await');
  ok(/onNo: \(\) => \{ if \(pr\) pr\.p\.then\(\(res\) => \{ for \(const r of res\) if \(r\.j\) net\.api\('remove'/.test(st), 'ביטול בחלון — העבודות שנוצרו מראש נמחקות'); }
{
  const Z = new Function(cut('export function quSer', 'const qdrClone').replace(/export /g, '') + '\nreturn { quSer, phQList };')();
  const fo = { a: 1, qgo: 1, qx: 1, fn: () => 1, o: { b: 2 } };
  const sv = Z.quSer(fo, (v) => { if (typeof v === 'function') throw new Error('x'); return JSON.parse(JSON.stringify(v)); });
  ok(sv.a === 1 && sv.o.b === 2 && !('fn' in sv) && !('qgo' in sv) && !('qx' in sv), 'quSer: מה שאפשר להעתיק, בלי פונקציות ובלי סימוני ההתחלה');
  const P = 'p0123456789abcdef', J = 'j' + 'A'.repeat(20), K = 'k'.repeat(43);
  ok(Z.phQList([{ p: P, j: J, k: K }, { p: 'bad', j: J, k: K }, { p: P, j: J, k: 'x' }]) === P + '.' + J + '.' + K, 'phQList: רק מה שעובר את התבניות של PhCore');
}
{ const ka = fs.readFileSync(path.join(__dirname, '..', 'android/app/src/studio/java/io/github/yishaiguedj1/snowball/PhActivity.kt'), 'utf8');
  const sv = fs.readFileSync(path.join(__dirname, '..', 'android/app/src/studio/java/io/github/yishaiguedj1/snowball/PhService.kt'), 'utf8');
  ok(/"phq" -> goQ\(d, false\)/.test(ka) && /"phq2" -> goQ\(d, true\)/.test(ka) && /PhService\.enqueue\(this, pids\)/.test(ka) && /if \(!r\.optBoolean\("pu"\) \|\| r\.optString\("yu"\) != u\) continue/.test(ka), 'האפליקציה: phq — כל פריט כמו go (רק בחירת nu), ולתור');
  ok(/cur = synchronized\(q\) \{ q\.removeFirstOrNull\(\) \}/.test(sv) && /if \(busy\) \{[^\n]*\n\s*startForeground\(/.test(sv), 'PhService: אחת אחרי השנייה; כבר רץ — מצטרפת לתור (עם startForeground)'); }
ok(/if \(!f \|\| !f\.qd \|\| !f\.qu \|\| f\.qgo\) return false;/.test(st) && /if \(f && f\.qgo\) return Promise\.resolve\(true\);/.test(st), 'quHold רק בתור ולא בזמן ההתחלה; ההתחלה — בלי שאלת אומדן לכל עבודה');
ok(/return \(async \(\) => \{\n    const file = f\.fileObj \|\| f\.drive;/.test(st) && /if \(f && f\.subs && !ui\.starting\) return startSubs\(f\);/.test(st) && /if \(L && L\.to === 'cloud'\) return startLinkCloud\(f\);/.test(st), 'startFromForm מחזיר הבטחה — ההתחלה של הרשימה אחת אחרי השנייה');
{ const ga = cut('async function quGoAll', '/* הקבוצות לעמוד');
  ok(/try \{ await startFromForm\(\); \}/.test(ga) && /const okd = form !== f;/.test(ga) && /askConfirm\(T\('studioQuGoQ'/.test(st) && /body: box/.test(st), 'quGoAsk: חלון עם כל העבודות; quGoAll: אחת אחרי השנייה, מה שנכשל נשאר ברשימה'); }
ok(/if \(f\.qgo\) \{ paintSoon\(\); return; \}/.test(st), 'jobOpen בהתחלה של הרשימה — בלי ניווט');
{
  const Q = new Function(cut('export function quCost', 'const quTm').replace(/export /g, '') + '\nreturn { quCost, quSpan };')();
  ok(Q.quCost({ ka: 1 }, 5, 0, 0.55) === 0 && Q.quCost({}, 2, 0, 0.55) === 2 && Q.quCost({ bt: 1 }, 2, 0, 0.55) === 1.1, 'quCost: קריוקי בחינם, תרגום, חצי מחיר');
  ok(Q.quCost({ vi: 1 }, 2, 1.5, 0.55) === 1.5 && Q.quCost({ vi: 1, vt: 1 }, 2, 1.5, 0.55) === 3.5 && Q.quCost({ vi: 1, dry: 1 }, 2, 1.5, 0.55) === 0, 'quCost: ניתוח, ניתוח + תרגום, ניתוח יבש');
  ok(Q.quSpan([600, 600, 600], 2) === 1200 && Q.quSpan([100], 2) === 100 && Q.quSpan([], 2) === 0, 'quSpan: מתי הכל מוכן, 2 במקביל');
}
ok((st.match(/quStamp\(f, /g) || []).length >= 4, 'כל המסלולים מסמנים את התור: סרטון/Drive, קובץ כתוביות, קישור לענן, דרך האפליקציה');
ok((st.match(/jobOpen\(f, rec\)/g) || []).length >= 4, 'אחרי ההתחלה — לעמוד התור (מכל מסלול)');
ok(/spec\.qu = f\.qu;/.test(st) && /if \(spec\.eng !== 'api'\) Object\.assign\(spec, \{ eng: 'api', cap: store\.settings\.cap \}\);\n  delete spec\.cp;/.test(st), 'quStamp: תמיד בשרת, בלי העתק־הדבק');
ok(/replaceView\('qnew', f\.qu\);/.test(st), 'jobOpen: לעמוד התור עם העבודות');
ok(/\.\.\.\(f\.qd && f\.qu \? \{ qu: f\.qu, qn: f\.qn \|\| '' \} : \{\}\)/.test(st) && /WL_RE\.test\(pend\.f\.qu\)\) Object\.assign\(f, \{ qd: 1, qu: pend\.f\.qu/.test(st), 'הורדה מקישור בטלפון — הטופס חוזר עם התור');
ok(/const listOk = \(f\) => !!\(btOk\(f\) && f\.fileObj && !f\.qd\);/.test(st) && /end: f\.ka \|\| f\.vi \|\| f\.qd \? null : saveTop/.test(st), 'בתור: בלי "עוד סרטון" ובלי טיוטה');
ok((st.match(/p\.append\(footStart\(f, /g) || []).length === 4 && /const q = !no && !f\.qd && quOk\(\) \? btn\('st-btn ghost wide st-foot-q', T\('studioQuAdd'\)/.test(st), 'בכל הכלים (תרגום, קובץ כתוביות, ניתוח, קריוקי) — אותה תחתית עם "להוסיף לתור"');
ok(/Object\.assign\(f, \{ qd: 1, qx: 1, qu, qn: qn \|\| '' \}\); qf = \{ qu, qn: qn \|\| '' \}; startFromForm\(\);/.test(st) && /if \(f\.qx && !ui\.starting\) \{ delete f\.qd; delete f\.qx;/.test(st), 'quPickFor: תור קיים או חדש → אותה התחלה; ביטול — הטופס חוזר להיות רגיל');
{ const pq = cut('function pageQu', 'function quKindMenu');
  ok(/r\.spec\.qu === q\.qu/.test(pq) && /projRow\(r, \{ act: true, qu: true, menu:/.test(pq) && /if \(o\.menu\) r\.addEventListener\('contextmenu'/.test(st), 'עמוד התור: העבודות האמיתיות של התור, עם לחיצה ארוכה'); }
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
ok(S.maxActive() >= 40, 'מגבלת העבודות הפעילות של השרתון');
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
ok(/else if \(ryMode\(\)\) Object\.assign\(spec, \{ eng: 'api', cap: store\.settings\.cap, ry: 1 \}\);/.test(cut('function formSpec', 'function startFromForm')) && /if \(spec\.eng !== 'api'\) Object\.assign\(spec, \{ eng: 'api'/.test(st) && /delete spec\.cp;/.test(st), '2.192.1: "המנוי שלי" — התרגום דרכו (formSpec); תמיד בשרת, בלי העתק־הדבק');
// 9. 20/11/2026 (תקלה: תור של 9 פרקים דרך האפליקציה — רק האחרון עלה ורץ): הסרטונים לענן במשימה אחת, לפי הסדר
{ const A = (f) => fs.readFileSync(path.join(root, 'android/app/src/studio/java/io/github/yishaiguedj1/snowball', f), 'utf8');
  const uj = A('PhUpJob.kt'), ac = A('PhActivity.kt'), ps = A('PhStore.kt');
  ok(/putString\("pids", l\.joinToString\(","\)\)/.test(uj) && /for \(pid in pids\)/.test(uj) && /js\.getPendingJob\(JOB_ID\)/.test(uj) && !/putString\("pid", pid\)/.test(uj), 'PhUpJob: רשימה אחת לפי הסדר, ממוזגת עם מה שכבר מחכה (לא מחליפה)');
  ok(/old\.filter\(pending\) \+ add\)\.distinct\(\)/.test(uj), 'merge: הישנות שעוד לא עלו קודם, אחריהן החדשות, בלי כפילויות');
  ok(/videoJobs\(pids\)/.test(ac) && !/for \(pid in pids\) videoJob\(pid\)/.test(ac) && /PhStore\.lostVideos\(this\)/.test(ac) && /fun lostVideos/.test(ps), 'goQ: תזמון אחד לכל הרשימה; סרטונים שנתקעו — חוזרים למשימה');
  ok(/const qrd = o\.qu && ph === 'ready' && !rec\.up\.wait;/.test(st) && /qup \|\| qrd \|\| \(\(o\.act \|\| o\.qu\) && ph === 'queued'\) \? \['amber', T\('studioBQueued'\)\]/.test(st), 'עמוד התור: עבודה שמחכה — "בתור", לא "מוכן"');
}
ok(/const btQb = \(f\) => btOk\(f\) \|\| !!\(ui\.api && ui\.api\.admin && apiMode\(\) && !f\.ka && !f\.vi && qbN\(f\)/.test(st) && /if \(btQb\(f\)\) p\.append\(secT\(T\('studioSecWhen'\)\)/.test(st), 'בתור עם כמה קבצים/תיקייה — חצי מחיר עדיין זמין (רק למנהל)');
// 10. 21/11/2026 (תקלה: תור בחצי מחיר — אחרי שתי הראשונות השאר "לבחור שוב את הסרטון"): הקובץ נשמר עד שעלה, וההמשך בשרשרת
ok(/return run\(\); \}\)\.catch\(\(\) => \{\}\);/.test(st), 'quUp: ה־catch של השרשרת בקוד, לא בתוך הערה — העלאה שנכשלה לא עוצרת את הבאות');
ok(/function keepFile\(id, file\) \{ if \(typeof Blob !== 'undefined' && file instanceof Blob\) handleOp\('put', id, \{ f: file \}\); \}/.test(st)
  && /else if \(!ext\) keepFile\(rec\.id, file\);/.test(st) && /keepFile\(r2\.id, m\.fileObj\)/.test(st), 'keepFile: עותק של קובץ בלי ידית — לעבודה הראשית ולכל קובץ נוסף');
ok(/else if \(hnd && hnd\.f instanceof Blob\) file = hnd\.f;/.test(st), 'resumeJob: ממשיך מהעותק השמור');
ok(/quChain = quChain\.then\(\(\) => \{ if \(!quPend\.delete\(id\)\) return null; paintSoon\(\); return startRun\(id, file\); \}\)\.catch/.test(st), 'resumeJob: המשך אוטומטי — אחת אחרי השנייה');
ok(/save\(\); handleOp\('del', id\);/.test(st) && /handleOp\('get', id\)\.then\(\(hd\) => \{ if \(hd && hd\.inbox\) inboxOp\('del', hd\.inbox\); handleOp\('del', id\); \}\)/.test(st), 'העותק נמחק כשהסרטון עלה (רגיל וברקע)');
ok(/if \(store\.jobs\.length\) handleOp\('keys'\)/.test(st) && /if \(v && v\.f instanceof Blob\) handleOp\('del', k\)/.test(st), 'ניקוי: רק עותקים ({f}) של עבודות שאינן / בוטלו; ידיות po: לא נוגעים');
// 11. 21/11/2026 (בקשת המשתמש): תור שעוד לא התחיל — בחירה מרובה, מחיקת הכל, ובחירה במנהל העבודות
ok(/function pageQuSel\(p, q, dr\)/.test(st) && /if \(quSel\) \{ pageQuSel\(p, q, dr\); return; \}/.test(st) && /'qu-drrm'/.test(st), 'דף התור: "לבחור" ו"למחוק את כל התור"');
ok(/askConfirm\(T\('studioQuDrRmQ'/.test(st) && /'sel-drq:' \+ qu/.test(st) && /for \(const qu of dq\) for \(const it of quDrOf\(qu\)\.slice\(\)\) quDrDel\(it\)/.test(st), 'מחיקה באישור; במנהל העבודות — גם תור שלם שלא התחיל');
ok(/if \(ui\.view === 'qnew'\) quSel = null;/.test(st) && /actDr = null; \}/.test(st), 'מצב הבחירה מתאפס ביציאה');
// 12. 21/11/2026 (בקשת המשתמש): חצי מחיר — קבוצה נפרדת ותמיד אחרי הרגילים; עדיפות בלקיחה כשהתשובות חזרו; כרטיסי תורים
const RB = (id, qu, state, created, bt) => ({ id, created, srv: { state }, spec: Object.assign({ qu }, bt ? { bt: 1 } : {}) });
const gb = P.quGroups([RB('1', 'qA', 'running', 1, 1), RB('2', 'qA', 'queued', 2), RB('3', 'qB', 'queued', 3), RB('4', 'qA', 'done', 4, 1)]);
ok(gb.map((g) => g.k).join() === 'qA,qB,qA~b' && gb[2].bt === 1 && gb[2].all.length === 2 && gb[2].done === 1 && gb[0].bt === 0,
  'quGroups: חצי מחיר — קבוצה נפרדת (גם מאותו תור), ותמיד אחרי כל התורים הרגילים');
ok(S.btBack({ id: 'a', bw: 5 }, ['a'], []) === 1 && S.btBack({ id: 'a', bw: 5 }, [], ['a']) === 1 && S.btBack({ id: 'a', bw: 0 }, ['a'], []) === 0 && S.btBack({ id: 'a', bw: 5 }, ['b'], []) === 0,
  'btBack: רק חצי מחיר שחונה ושהתשובות שלו חזרו (או שהתור שלו אבד)');
const ibs = api.indexOf('qd.sort((a, b) => S.btBack(b, br, lost) - S.btBack(a, br, lost));'), ilost = api.indexOf('const lost = bqOn');
ok(ilost > 0 && ibs > ilost && ibs < api.indexOf('const quFull = async'), 'הלקיחה: חצי מחיר שחזר — לפני כל עבודה רגילה (מיון אחרי lost, לפני הלולאה)');
ok(/function quCard\(g, o = \{\}\)/.test(st) && /secT\(T\('studioQcSec'\)\), \.\.\.gR\.map/.test(st) && /secT\(T\('studioQcBtSec'\)\), \.\.\.gB\.map/.test(st)
  && st.indexOf("secT(T('studioQcSec'))") < st.indexOf("secT(T('studioQcBtSec'))") && !/for \(const g of gs\) p\.append\(\.\.\.quSection\(g\)\);\n  if \(drOnly\.length\) p\.append\(secT\(T\('studioQuDrNew'\)\), list\(\.\.\.drOnly\.map\(\(qu\) => rowNav/.test(st),
  'מנהל העבודות: רק כרטיסי תורים — הרגילים ואז חצי מחיר');
ok(/quSplit\(all, q\.qu, q\.qn\)/.test(st) && /quCard\(g, \{ hero: true \}\)/.test(st) && /quCard\(g, \{ hero: true \}\)\), quCtrls\(w, dr\.length > 0\)\);\n\s+for \(const g of parts\) p\.append\(secT/.test(st), 'עמוד התור: כרטיס לכל חלק, מיד מתחתיו הפקדים, ואז העבודות');
ok(/function quCtrls[\s\S]{0,300}h\('div', 'st-qa st-qa-q'\)/.test(st) && !/studioQuHoldAllS/.test(st), 'פקדי התור: כפתורים עגולים בלי שורות הסבר');
ok(/sid: job\.spec\.bt === 1 \? null : ''/.test(api) && /sid: null \}, 30\)/.test(api) && /\.filter\(\(j\) => j\.bw && !j\.qh\)/.test(api) && /\{ bw: 0, sid: job\.qh \? null : '' \}/.test(api)
  && S.quPatch({ qh: 1, state: 'queued', bw: 5 }, 'run', 10).sid === null && S.quPatch({ qh: 1, state: 'queued' }, 'run', 10).sid === '',
  'חונה בחצי מחיר — sid: null (מחוץ לתקרת שאילתת הלקיחה), נקראת בנפרד רק כשצריך; "עכשיו"/המשך מחזירים אותה');
console.log('# ' + n + ' בדיקות');
